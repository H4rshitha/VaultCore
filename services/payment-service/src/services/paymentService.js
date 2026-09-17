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
} from '@vaultcore/shared';

const logger = createLogger('payment-service-logic');
const paymentRepository = new PaymentRepository();

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

      if (sourceAccount.userId !== userId && role !== 'ADMIN') {
        logger.warn(`Unauthorized transfer attempt: User ${userId} tried to debit account ${sourceAccountNumber}`, {
          traceId,
        });
        throw new ForbiddenError('Access denied: You do not own the source bank account');
      }

      if (sourceAccount.status !== 'ACTIVE') {
        throw new BadRequestError(`Source account ${sourceAccountNumber} is ${sourceAccount.status}`);
      }

      // 5. Validate Target Account
      const targetAccount = await paymentRepository.findAccountByNumber(targetAccountNumber);
      if (!targetAccount) {
        throw new NotFoundError(`Target account ${targetAccountNumber} not found`);
      }

      if (targetAccount.status !== 'ACTIVE') {
        throw new BadRequestError(`Target account ${targetAccountNumber} is ${targetAccount.status}`);
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
        const { transaction: completedTransaction, outboxEvent, auditLog } =
          await paymentRepository.finalizeSuccessfulTransaction({
            transactionId: pendingTransaction.id,
            referenceId,
            sourceAccountId: sourceAccount.id,
            targetAccountId: targetAccount.id,
            amount,
            currency,
            userId,
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

        logger.info('Payment completed successfully, cache invalidated, and idempotency recorded', {
          transactionId: completedTransaction.id,
          referenceId,
          outboxEventId: outboxEvent.id,
          auditLogId: auditLog.id,
          sourceAccountNumber,
          targetAccountNumber,
          traceId,
        });

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
      logger.warn(`Unauthorized payment lookup for reference ${referenceId} by user ${userId}`, { traceId });
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
}
