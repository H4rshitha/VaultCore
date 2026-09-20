import { PaymentRepository } from '../repositories/paymentRepository.js';
import { LedgerClient } from '../clients/ledgerClient.js';
import { generateReferenceId } from '../utils/referenceGenerator.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  createLogger,
  accountCache,
  lockService,
  createRedisClient,
} from '@vaultcore/shared';

const logger = createLogger('payment-service-logic');
const paymentRepository = new PaymentRepository();
const liveEventBus = createRedisClient({ db: 3 }, logger);

export class PaymentService {
  /**
   * Orchestrate money transfer with Distributed Locking (Redis DB2), Two-Layer Idempotency,
   * PENDING creation, Ledger call, Outbox/Audit recording, and guaranteed lock release in try/finally.
   */
  async processTransfer(userContext, transferData, metaContext = {}) {
    const { userId, role } = userContext;
    const { traceId, ip, userAgent } = metaContext;
    const {
      idempotencyKey,
      sourceAccountNumber,
      targetAccountNumber,
      amount,
      currency = 'USD',
      description,
    } = transferData;

    // 1. Layer 1 Idempotency Check (Redis DB2 - 24h fast cache)
    const cachedIdempotentResult = await lockService.getIdempotencyRecord(idempotencyKey, traceId);
    if (cachedIdempotentResult) {
      logger.info('Idempotent transfer returned from Redis DB2 (Layer 1)', {
        idempotencyKey,
        referenceId: cachedIdempotentResult.referenceId,
        traceId,
      });
      return {
        ...cachedIdempotentResult,
        isIdempotent: true,
      };
    }

    // 2. Deterministic Distributed Locking on Redis DB2
    // Always locks accounts in ascending alphabetical order to prevent deadlocks.
    // If conflict occurs, releases any partial locks and throws 409 ConflictError.
    const accountsToLock = [sourceAccountNumber, targetAccountNumber];
    const acquiredLocks = await lockService.acquireAccountLocks(accountsToLock, traceId);

    try {
      // 3. Layer 2 Idempotency Check (PostgreSQL unique key check under lock)
      const existingTransaction = await paymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existingTransaction) {
        logger.info('Idempotent transfer detected in PostgreSQL (Layer 2), caching to Redis DB2', {
          idempotencyKey,
          referenceId: existingTransaction.referenceId,
          traceId,
        });
        lockService.metrics.idempotencyHitsPostgres++;

        const responsePayload = {
          transaction: existingTransaction,
          referenceId: existingTransaction.referenceId,
          status: existingTransaction.status,
          amount: existingTransaction.amount,
          currency: existingTransaction.currency,
          sourceAccountNumber,
          targetAccountNumber,
          description: existingTransaction.description,
          isIdempotent: true,
        };

        // Populate Redis DB2 fast cache for future requests
        await lockService.setIdempotencyRecord(idempotencyKey, responsePayload, traceId);
        return responsePayload;
      }

      // 4. Validate Source Account & Ownership
      const sourceAccount = await paymentRepository.findAccountByNumber(sourceAccountNumber);
      if (!sourceAccount) {
        throw new NotFoundError(`Source account ${sourceAccountNumber} not found`);
      }

      if (sourceAccount.userId !== userId && role !== 'ADMIN' && role !== 'TELLER') {
        logger.warn(
          `Unauthorized transfer attempt: User ${userId} tried to debit account ${sourceAccountNumber}`,
          {
            traceId,
          }
        );
        throw new ForbiddenError('Access denied: You do not own the source bank account');
      }

      if (sourceAccount.status !== 'ACTIVE') {
        throw new BadRequestError(
          `Source account ${sourceAccountNumber} is ${sourceAccount.status}`
        );
      }

      // 5. Validate Target Account
      const targetAccount = await paymentRepository.findAccountByNumber(targetAccountNumber);
      if (!targetAccount) {
        throw new NotFoundError(`Target account ${targetAccountNumber} not found`);
      }

      if (targetAccount.status !== 'ACTIVE') {
        throw new BadRequestError(
          `Target account ${targetAccountNumber} is ${targetAccount.status}`
        );
      }

      // 6. Validate Sufficient Balance
      if (Number(sourceAccount.balance) < Number(amount)) {
        throw new BadRequestError(
          `Insufficient funds in account ${sourceAccountNumber}. Current balance: ${sourceAccount.balance} ${sourceAccount.currency}`
        );
      }

      // 7. Generate unique Reference ID
      const referenceId = generateReferenceId();

      // 8. Create Transaction record with PENDING status
      const pendingTransaction = await paymentRepository.createPendingTransaction({
        idempotencyKey,
        referenceId,
        sourceAccountId: sourceAccount.id,
        targetAccountId: targetAccount.id,
        amount,
        currency,
        description,
      });

      logger.info('Transaction created with PENDING status', {
        transactionId: pendingTransaction.id,
        referenceId,
        traceId,
      });

      try {
        // 9. Call internal Ledger Service with x-service-api-key and X-Trace-ID
        await LedgerClient.recordDoubleEntry({
          idempotencyKey,
          referenceId,
          sourceAccountNumber,
          targetAccountNumber,
          amount,
          currency,
          description,
          traceId,
        });

        // 10. On successful ledger posting: Update status to COMPLETED, write OutboxEvent and AuditLog
        const userEmail = userContext.email || sourceAccount.user?.email;
        const {
          transaction: completedTransaction,
          outboxEvent,
          auditLog,
        } = await paymentRepository.finalizeSuccessfulTransaction({
          transactionId: pendingTransaction.id,
          referenceId,
          sourceAccountId: sourceAccount.id,
          targetAccountId: targetAccount.id,
          amount,
          currency,
          userId,
          email: userEmail,
          recipient: userEmail,
          ipAddress: ip,
          userAgent,
        });

        // Invalidate Redis DB1 cached balance and details for both sender and receiver accounts
        await accountCache.invalidateAccounts([sourceAccountNumber, targetAccountNumber], traceId);

        const successResponse = {
          transaction: completedTransaction,
          referenceId,
          status: 'COMPLETED',
          amount,
          currency,
          sourceAccountNumber,
          targetAccountNumber,
          description,
          isIdempotent: false,
        };

        // Cache completed payment in Redis DB2 for 24 hours (Layer 1 Idempotency)
        await lockService.setIdempotencyRecord(idempotencyKey, successResponse, traceId);

        // Publish real-time live event to Redis DB3 bus (for instant SSE broadcast and notification fallback)
        try {
          liveEventBus.publish(
            'vaultcore:events:stream',
            JSON.stringify({
              id: outboxEvent.id,
              eventId: outboxEvent.id,
              type: 'payment.completed',
              eventType: 'payment.completed',
              routingKey: 'payment.completed',
              traceId,
              transactionId: completedTransaction.id,
              referenceId,
              amount,
              currency,
              sourceAccountNumber,
              targetAccountNumber,
              recipient: userEmail,
              payload: {
                transactionId: completedTransaction.id,
                referenceId,
                amount,
                currency,
                email: userEmail,
                recipient: userEmail,
                sourceAccountNumber,
                targetAccountNumber,
              },
              timestamp: new Date().toISOString(),
            })
          );
        } catch (_) {}

        return successResponse;
      } catch (ledgerError) {
        // 11. If ledger posting fails: Mark transaction as FAILED
        logger.error('Ledger posting failed, marking transaction as FAILED', {
          transactionId: pendingTransaction.id,
          referenceId,
          error: ledgerError.message,
          traceId,
        });

        await paymentRepository.markTransactionFailed(pendingTransaction.id, ledgerError.message);
        throw ledgerError;
      }
    } finally {
      // 12. Guaranteed safe release of distributed locks via Lua script on Redis DB2
      await lockService.releaseAccountLocks(acquiredLocks, traceId);
    }
  }

  /**
   * Fetch payment details by Reference ID with ledger correlation
   */
  async getPaymentByReference(referenceId, userContext, traceId) {
    const { userId, role } = userContext;
    const transaction = await paymentRepository.findByReferenceId(referenceId);

    if (!transaction) {
      throw new NotFoundError(`Payment with reference ID ${referenceId} not found`);
    }

    const isSender = transaction.sourceAccount?.userId === userId;
    const isReceiver = transaction.targetAccount?.userId === userId;

    if (!isSender && !isReceiver && role !== 'ADMIN' && role !== 'TELLER') {
      logger.warn(`Unauthorized payment lookup for reference ${referenceId} by user ${userId}`, {
        traceId,
      });
      throw new ForbiddenError('Access denied: You are not authorized to view this payment');
    }

    logger.info('Payment details retrieved by reference ID', {
      referenceId,
      transactionId: transaction.id,
      traceId,
    });

    return transaction;
  }

  /**
   * Fetch cursor-paginated payment history for authenticated customer with filters
   */
  async getPaymentHistory(userContext, filters, traceId) {
    const { userId, role } = userContext;
    logger.info('Fetching user payment history', { userId, role, filters, traceId });

    const result = await paymentRepository.getPaginatedTransactions(userContext, filters);
    return result;
  }

  /**
   * Search transactions with advanced filters (referenceId, accountNumber, status, type, amount, date)
   */
  async searchPayments(userContext, filters, traceId) {
    const { userId, role } = userContext;
    logger.info('Searching payments with filters', { userId, role, filters, traceId });

    const result = await paymentRepository.getPaginatedTransactions(userContext, filters);
    return result;
  }

  /**
   * Financial analytics and summary dashboard
   */
  async getFinancialSummary(userContext, filters, traceId) {
    const { userId, role } = userContext;
    logger.info('Generating financial summary dashboard', { userId, role, filters, traceId });

    const summary = await paymentRepository.getFinancialSummary(userContext, filters);
    return summary;
  }

  /**
   * Cash Deposit (Orchestrated with distributed locking, idempotency, ledger credit, and cache invalidation)
   */
  async processDeposit(userContext, depositData, metaContext = {}) {
    const { userId, role } = userContext;
    const { traceId, ip, userAgent } = metaContext;
    const {
      idempotencyKey,
      accountNumber,
      amount,
      currency = 'USD',
      description = 'Cash Deposit',
    } = depositData;

    // 1. Layer 1 Idempotency Check
    const cachedResult = await lockService.getIdempotencyRecord(idempotencyKey, traceId);
    if (cachedResult) {
      return { ...cachedResult, isIdempotent: true };
    }

    // 2. Lock Account on Redis DB2
    const acquiredLocks = await lockService.acquireAccountLocks([accountNumber], traceId);

    try {
      // 3. Layer 2 Idempotency Check
      const existingTx = await paymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existingTx) {
        const responsePayload = {
          transaction: existingTx,
          referenceId: existingTx.referenceId,
          status: existingTx.status,
          amount: existingTx.amount,
          currency: existingTx.currency,
          accountNumber,
          description: existingTx.description,
          isIdempotent: true,
        };
        await lockService.setIdempotencyRecord(idempotencyKey, responsePayload, traceId);
        return responsePayload;
      }

      // 4. Validate Account
      const account = await paymentRepository.findAccountByNumber(accountNumber);
      if (!account) {
        throw new NotFoundError(`Account ${accountNumber} not found`);
      }
      if (account.status !== 'ACTIVE') {
        throw new BadRequestError(`Account ${accountNumber} is ${account.status}`);
      }

      const referenceId = generateReferenceId();

      // 5. Call Ledger Service Deposit
      const ledgerResult = await LedgerClient.recordDeposit({
        idempotencyKey,
        referenceId,
        accountNumber,
        amount,
        currency,
        description,
        traceId,
      });

      // 6. Invalidate Account Cache
      await accountCache.invalidateAccounts([accountNumber], traceId);

      const userEmail = userContext.email || account.user?.email;

      // 7. Record Outbox Event & Audit Log
      let depositOutbox = null;
      try {
        const outboxResult = await paymentRepository.recordOperationOutbox({
          transactionId: ledgerResult.transaction?.id,
          referenceId,
          eventType: 'PAYMENT_COMPLETED',
          accountId: account.id,
          accountNumber,
          amount,
          currency,
          userId: account.userId || userId,
          email: userEmail,
          action: 'CASH_DEPOSIT',
          ipAddress: ip,
          userAgent,
        });
        depositOutbox = outboxResult.outboxEvent;
      } catch (_) {}

      // 8. Publish Real-Time Event to Redis DB3 bus
      try {
        liveEventBus.publish(
          'vaultcore:events:stream',
          JSON.stringify({
            id: depositOutbox?.id || `evt-${Date.now()}`,
            eventId: depositOutbox?.id || `evt-${Date.now()}`,
            type: 'payment.completed',
            eventType: 'payment.completed',
            routingKey: 'payment.completed',
            traceId,
            transactionId: ledgerResult.transaction?.id,
            referenceId,
            amount: Number(amount),
            currency,
            accountNumber,
            recipient: userEmail,
            payload: {
              transactionId: ledgerResult.transaction?.id,
              referenceId,
              amount: Number(amount),
              currency,
              email: userEmail,
              recipient: userEmail,
              accountNumber,
              type: 'DEPOSIT',
            },
            timestamp: new Date().toISOString(),
          })
        );
      } catch (_) {}

      const responsePayload = {
        transaction: ledgerResult.transaction,
        account: ledgerResult.account,
        referenceId,
        status: 'COMPLETED',
        amount,
        currency,
        accountNumber,
        description,
        isIdempotent: false,
      };

      await lockService.setIdempotencyRecord(idempotencyKey, responsePayload, traceId);
      logger.info('Cash deposit processed successfully', {
        accountNumber,
        amount,
        referenceId,
        traceId,
      });
      return responsePayload;
    } finally {
      await lockService.releaseAccountLocks(acquiredLocks, traceId);
    }
  }

  /**
   * Cash Withdrawal (Orchestrated with distributed locking, balance verification, ledger debit, and cache invalidation)
   */
  async processWithdrawal(userContext, withdrawalData, metaContext = {}) {
    const { userId, role } = userContext;
    const { traceId, ip, userAgent } = metaContext;
    const {
      idempotencyKey,
      accountNumber,
      amount,
      currency = 'USD',
      description = 'Cash Withdrawal',
    } = withdrawalData;

    // 1. Layer 1 Idempotency Check
    const cachedResult = await lockService.getIdempotencyRecord(idempotencyKey, traceId);
    if (cachedResult) {
      return { ...cachedResult, isIdempotent: true };
    }

    // 2. Lock Account on Redis DB2
    const acquiredLocks = await lockService.acquireAccountLocks([accountNumber], traceId);

    try {
      // 3. Layer 2 Idempotency Check
      const existingTx = await paymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existingTx) {
        const responsePayload = {
          transaction: existingTx,
          referenceId: existingTx.referenceId,
          status: existingTx.status,
          amount: existingTx.amount,
          currency: existingTx.currency,
          accountNumber,
          description: existingTx.description,
          isIdempotent: true,
        };
        await lockService.setIdempotencyRecord(idempotencyKey, responsePayload, traceId);
        return responsePayload;
      }

      // 4. Validate Account & Ownership
      const account = await paymentRepository.findAccountByNumber(accountNumber);
      if (!account) {
        throw new NotFoundError(`Account ${accountNumber} not found`);
      }
      if (account.userId !== userId && role !== 'ADMIN' && role !== 'TELLER') {
        throw new ForbiddenError('Access denied: You do not own this bank account');
      }
      if (account.status !== 'ACTIVE') {
        throw new BadRequestError(`Account ${accountNumber} is ${account.status}`);
      }
      if (Number(account.balance) < Number(amount)) {
        throw new BadRequestError(
          `Insufficient funds in account ${accountNumber}. Current balance: ${account.balance} ${account.currency}`
        );
      }

      const referenceId = generateReferenceId();

      // 5. Call Ledger Service Withdrawal
      const ledgerResult = await LedgerClient.recordWithdrawal({
        idempotencyKey,
        referenceId,
        accountNumber,
        amount,
        currency,
        description,
        traceId,
      });

      // 6. Invalidate Account Cache
      await accountCache.invalidateAccounts([accountNumber], traceId);

      const userEmail = userContext.email || account.user?.email;

      // 7. Record Outbox Event & Audit Log
      let withdrawalOutbox = null;
      try {
        const outboxResult = await paymentRepository.recordOperationOutbox({
          transactionId: ledgerResult.transaction?.id,
          referenceId,
          eventType: 'PAYMENT_COMPLETED',
          accountId: account.id,
          accountNumber,
          amount,
          currency,
          userId: account.userId || userId,
          email: userEmail,
          action: 'CASH_WITHDRAWAL',
          ipAddress: ip,
          userAgent,
        });
        withdrawalOutbox = outboxResult.outboxEvent;
      } catch (_) {}

      // 8. Publish Real-Time Event to Redis DB3 bus
      try {
        liveEventBus.publish(
          'vaultcore:events:stream',
          JSON.stringify({
            id: withdrawalOutbox?.id || `evt-${Date.now()}`,
            eventId: withdrawalOutbox?.id || `evt-${Date.now()}`,
            type: 'payment.completed',
            eventType: 'payment.completed',
            routingKey: 'payment.completed',
            traceId,
            transactionId: ledgerResult.transaction?.id,
            referenceId,
            amount: Number(amount),
            currency,
            accountNumber,
            recipient: userEmail,
            payload: {
              transactionId: ledgerResult.transaction?.id,
              referenceId,
              amount: Number(amount),
              currency,
              email: userEmail,
              recipient: userEmail,
              accountNumber,
              type: 'WITHDRAWAL',
            },
            timestamp: new Date().toISOString(),
          })
        );
      } catch (_) {}

      const responsePayload = {
        transaction: ledgerResult.transaction,
        account: ledgerResult.account,
        referenceId,
        status: 'COMPLETED',
        amount,
        currency,
        accountNumber,
        description,
        isIdempotent: false,
      };

      await lockService.setIdempotencyRecord(idempotencyKey, responsePayload, traceId);
      logger.info('Cash withdrawal processed successfully', {
        accountNumber,
        amount,
        referenceId,
        traceId,
      });
      return responsePayload;
    } finally {
      await lockService.releaseAccountLocks(acquiredLocks, traceId);
    }
  }
}
