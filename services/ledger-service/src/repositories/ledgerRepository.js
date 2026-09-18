import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError, ConflictError } from '@vaultcore/shared';

const prisma = new PrismaClient();

export class LedgerRepository {
  /**
   * Find account by 12-digit account number
   */
  async findAccountByNumber(accountNumber) {
    return prisma.account.findFirst({
      where: { accountNumber, deletedAt: null },
    });
  }

  /**
   * Execute double-entry transfer & balance update inside a single PostgreSQL ACID transaction
   */
  async executeDoubleEntryTransfer({
    idempotencyKey,
    referenceId,
    sourceAccountNumber,
    targetAccountNumber,
    amount,
    currency = 'USD',
    description,
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check (True duplicate: COMPLETED with ledger entries)
      const existingTx = await tx.transaction.findUnique({
        where: { idempotencyKey },
        include: { ledgerEntries: true },
      });
      if (
        existingTx &&
        existingTx.status === 'COMPLETED' &&
        existingTx.ledgerEntries &&
        existingTx.ledgerEntries.length > 0
      ) {
        return { transaction: existingTx, isIdempotent: true };
      }

      // 2. Fetch and validate accounts
      const sourceAccount = await tx.account.findFirst({
        where: { accountNumber: sourceAccountNumber, deletedAt: null },
      });
      if (!sourceAccount) {
        throw new NotFoundError(`Source account ${sourceAccountNumber} not found`);
      }
      if (sourceAccount.status !== 'ACTIVE') {
        throw new BadRequestError(
          `Source account ${sourceAccountNumber} is ${sourceAccount.status}`
        );
      }

      const targetAccount = await tx.account.findFirst({
        where: { accountNumber: targetAccountNumber, deletedAt: null },
      });
      if (!targetAccount) {
        throw new NotFoundError(`Target account ${targetAccountNumber} not found`);
      }
      if (targetAccount.status !== 'ACTIVE') {
        throw new BadRequestError(
          `Target account ${targetAccountNumber} is ${targetAccount.status}`
        );
      }

      // 3. Sufficient Funds Check
      const sourceBalanceNum = Number(sourceAccount.balance);
      const transferAmountNum = Number(amount);

      if (sourceBalanceNum < transferAmountNum) {
        throw new BadRequestError(
          `Insufficient funds in account ${sourceAccountNumber}. Current balance: ${sourceAccount.balance} ${sourceAccount.currency}`
        );
      }

      // 4. Calculate new balances
      const newSourceBalance = sourceBalanceNum - transferAmountNum;
      const newTargetBalance = Number(targetAccount.balance) + transferAmountNum;

      // 5. Update Account Balances with Optimistic Locking (version = expectedVersion)
      const sourceUpdate = await tx.account.updateMany({
        where: { id: sourceAccount.id, version: sourceAccount.version },
        data: {
          balance: newSourceBalance,
          version: { increment: 1 },
        },
      });

      if (sourceUpdate.count === 0) {
        throw new ConflictError(
          `Optimistic lock conflict on source account ${sourceAccountNumber}: concurrent modification detected. Please retry the transfer.`
        );
      }

      const targetUpdate = await tx.account.updateMany({
        where: { id: targetAccount.id, version: targetAccount.version },
        data: {
          balance: newTargetBalance,
          version: { increment: 1 },
        },
      });

      if (targetUpdate.count === 0) {
        throw new ConflictError(
          `Optimistic lock conflict on target account ${targetAccountNumber}: concurrent modification detected. Please retry the transfer.`
        );
      }

      // Re-fetch updated accounts to return current state
      const updatedSourceAccount = await tx.account.findUnique({ where: { id: sourceAccount.id } });
      const updatedTargetAccount = await tx.account.findUnique({ where: { id: targetAccount.id } });

      // 6. Reuse existing Transaction or create if not present
      let transactionRecord;
      if (existingTx) {
        transactionRecord = existingTx;
      } else {
        transactionRecord = await tx.transaction.create({
          data: {
            idempotencyKey,
            referenceId,
            sourceAccountId: sourceAccount.id,
            targetAccountId: targetAccount.id,
            amount: transferAmountNum,
            currency,
            type: 'TRANSFER',
            status: 'PENDING',
            description,
          },
        });
      }

      // 7. Create Immutable DEBIT & CREDIT Ledger Entries
      const debitEntry = await tx.ledgerEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: sourceAccount.id,
          type: 'DEBIT',
          amount: transferAmountNum,
          balanceAfter: newSourceBalance,
        },
      });

      const creditEntry = await tx.ledgerEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: targetAccount.id,
          type: 'CREDIT',
          amount: transferAmountNum,
          balanceAfter: newTargetBalance,
        },
      });

      return {
        transaction: transactionRecord,
        ledgerEntries: [debitEntry, creditEntry],
        sourceAccount: updatedSourceAccount,
        targetAccount: updatedTargetAccount,
        isIdempotent: false,
      };
    });
  }

  /**
   * Fetch ledger history for an account with Cursor Pagination, Date Filters, Type Filter, Reference Search
   */
  async getAccountLedgerEntries(
    accountId,
    { cursor, limit = 20, type, startDate, endDate, referenceId }
  ) {
    const where = {
      accountId,
    };

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (referenceId) {
      where.transaction = {
        referenceId: {
          contains: referenceId,
          mode: 'insensitive',
        },
      };
    }

    const take = limit + 1; // Fetch 1 extra to determine if next cursor exists

    const entries = await prisma.ledgerEntry.findMany({
      where,
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: {
          select: {
            id: true,
            idempotencyKey: true,
            referenceId: true,
            type: true,
            status: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    let nextCursor = null;
    if (entries.length > limit) {
      const nextItem = entries.pop(); // Remove extra item
      nextCursor = nextItem.id;
    }

    return {
      entries,
      nextCursor,
    };
  }

  /**
   * Execute ACID single-account cash deposit (CREDIT ledger entry + Account Balance Increment with Optimistic Locking)
   */
  async executeDeposit({
    idempotencyKey,
    referenceId,
    accountNumber,
    amount,
    currency = 'USD',
    description = 'Cash Deposit',
  }) {
    return prisma.$transaction(async (tx) => {
      const existingTx = await tx.transaction.findUnique({
        where: { idempotencyKey },
        include: { ledgerEntries: true },
      });
      if (
        existingTx &&
        existingTx.status === 'COMPLETED' &&
        existingTx.ledgerEntries &&
        existingTx.ledgerEntries.length > 0
      ) {
        return { transaction: existingTx, isIdempotent: true };
      }

      const account = await tx.account.findFirst({
        where: { accountNumber, deletedAt: null },
      });
      if (!account) {
        throw new NotFoundError(`Account ${accountNumber} not found`);
      }
      if (account.status !== 'ACTIVE') {
        throw new BadRequestError(`Account ${accountNumber} is ${account.status}`);
      }

      const depositAmount = Number(amount);
      const newBalance = Number(account.balance) + depositAmount;

      const updateRes = await tx.account.updateMany({
        where: { id: account.id, version: account.version },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      if (updateRes.count === 0) {
        throw new ConflictError(
          `Optimistic lock conflict on account ${accountNumber}: concurrent modification detected. Please retry the deposit.`
        );
      }

      const updatedAccount = await tx.account.findUnique({ where: { id: account.id } });

      let transactionRecord = existingTx;
      if (!transactionRecord) {
        transactionRecord = await tx.transaction.create({
          data: {
            idempotencyKey,
            referenceId,
            targetAccountId: account.id,
            amount: depositAmount,
            currency,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            description,
          },
        });
      }

      const creditEntry = await tx.ledgerEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: account.id,
          type: 'CREDIT',
          amount: depositAmount,
          balanceAfter: newBalance,
        },
      });

      return {
        transaction: transactionRecord,
        ledgerEntries: [creditEntry],
        account: updatedAccount,
        isIdempotent: false,
      };
    });
  }

  /**
   * Execute ACID single-account cash withdrawal (DEBIT ledger entry + Account Balance Decrement with Optimistic Locking)
   */
  async executeWithdrawal({
    idempotencyKey,
    referenceId,
    accountNumber,
    amount,
    currency = 'USD',
    description = 'Cash Withdrawal',
  }) {
    return prisma.$transaction(async (tx) => {
      const existingTx = await tx.transaction.findUnique({
        where: { idempotencyKey },
        include: { ledgerEntries: true },
      });
      if (
        existingTx &&
        existingTx.status === 'COMPLETED' &&
        existingTx.ledgerEntries &&
        existingTx.ledgerEntries.length > 0
      ) {
        return { transaction: existingTx, isIdempotent: true };
      }

      const account = await tx.account.findFirst({
        where: { accountNumber, deletedAt: null },
      });
      if (!account) {
        throw new NotFoundError(`Account ${accountNumber} not found`);
      }
      if (account.status !== 'ACTIVE') {
        throw new BadRequestError(`Account ${accountNumber} is ${account.status}`);
      }

      const withdrawAmount = Number(amount);
      const currentBalance = Number(account.balance);

      if (currentBalance < withdrawAmount) {
        throw new BadRequestError(
          `Insufficient funds in account ${accountNumber}. Current balance: ${account.balance} ${account.currency}`
        );
      }

      const newBalance = currentBalance - withdrawAmount;

      const updateRes = await tx.account.updateMany({
        where: { id: account.id, version: account.version },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      if (updateRes.count === 0) {
        throw new ConflictError(
          `Optimistic lock conflict on account ${accountNumber}: concurrent modification detected. Please retry the withdrawal.`
        );
      }

      const updatedAccount = await tx.account.findUnique({ where: { id: account.id } });

      let transactionRecord = existingTx;
      if (!transactionRecord) {
        transactionRecord = await tx.transaction.create({
          data: {
            idempotencyKey,
            referenceId,
            sourceAccountId: account.id,
            amount: withdrawAmount,
            currency,
            type: 'WITHDRAWAL',
            status: 'COMPLETED',
            description,
          },
        });
      }

      const debitEntry = await tx.ledgerEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: account.id,
          type: 'DEBIT',
          amount: withdrawAmount,
          balanceAfter: newBalance,
        },
      });

      return {
        transaction: transactionRecord,
        ledgerEntries: [debitEntry],
        account: updatedAccount,
        isIdempotent: false,
      };
    });
  }
}

