import { LedgerRepository } from '../repositories/ledgerRepository.js';
import { NotFoundError, ForbiddenError, createLogger } from '@vaultcore/shared';

const logger = createLogger('ledger-service-logic');
const ledgerRepository = new LedgerRepository();

export class LedgerService {
  /**
   * Execute ACID double-entry transfer (1 DEBIT + 1 CREDIT + Account Balance Updates)
   */
  async recordDoubleEntryTransfer(payload, traceId) {
    const result = await ledgerRepository.executeDoubleEntryTransfer(payload);

    if (result.isIdempotent) {
      logger.info('Duplicate idempotency key detected, returning existing transaction', {
        idempotencyKey: payload.idempotencyKey,
        traceId,
      });
    } else {
      logger.info('Double-entry transfer recorded in PostgreSQL ACID transaction', {
        transactionId: result.transaction.id,
        referenceId: payload.referenceId,
        sourceAccountNumber: payload.sourceAccountNumber,
        targetAccountNumber: payload.targetAccountNumber,
        amount: payload.amount,
        traceId,
      });
    }

    return result;
  }

  /**
   * Fetch ledger history for account with authorization and cursor pagination
   */
  async getAccountLedgerHistory(
    accountNumber,
    requestingUserId,
    requestingUserRole,
    filters,
    traceId
  ) {
    const account = await ledgerRepository.findAccountByNumber(accountNumber);
    if (!account) {
      throw new NotFoundError(`Account ${accountNumber} not found`);
    }

    // Ownership authorization check
    if (
      account.userId !== requestingUserId &&
      requestingUserRole !== 'ADMIN' &&
      requestingUserRole !== 'TELLER'
    ) {
      logger.warn(
        `Unauthorized ledger access attempt: User ${requestingUserId} requested ${accountNumber}`,
        {
          traceId,
          accountNumber,
          userId: requestingUserId,
        }
      );
      throw new ForbiddenError('Access denied: You do not own this bank account');
    }

    logger.info('Fetching ledger history for account', {
      accountNumber,
      userId: requestingUserId,
      traceId,
    });

    const { entries, nextCursor } = await ledgerRepository.getAccountLedgerEntries(
      account.id,
      filters
    );

    return {
      accountNumber: account.accountNumber,
      currency: account.currency,
      entries,
      pagination: {
        limit: filters.limit || 20,
        nextCursor,
      },
    };
  }

  /**
   * Execute ACID cash deposit
   */
  async recordDeposit(payload, traceId) {
    const result = await ledgerRepository.executeDeposit(payload);
    logger.info('Cash deposit recorded in PostgreSQL ACID transaction', {
      transactionId: result.transaction.id,
      referenceId: payload.referenceId,
      accountNumber: payload.accountNumber,
      amount: payload.amount,
      traceId,
    });
    return result;
  }

  /**
   * Execute ACID cash withdrawal
   */
  async recordWithdrawal(payload, traceId) {
    const result = await ledgerRepository.executeWithdrawal(payload);
    logger.info('Cash withdrawal recorded in PostgreSQL ACID transaction', {
      transactionId: result.transaction.id,
      referenceId: payload.referenceId,
      accountNumber: payload.accountNumber,
      amount: payload.amount,
      traceId,
    });
    return result;
  }
}
