import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PaymentRepository {
  async findAccountByNumber(accountNumber) {
    return prisma.account.findFirst({
      where: { accountNumber, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAccountByNumberAndUserId(accountNumber, userId) {
    return prisma.account.findFirst({
      where: { accountNumber, userId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async findByIdempotencyKey(idempotencyKey) {
    return prisma.transaction.findUnique({
      where: { idempotencyKey },
      include: {
        sourceAccount: { select: { accountNumber: true, userId: true } },
        targetAccount: { select: { accountNumber: true, userId: true } },
        ledgerEntries: true,
      },
    });
  }

  async findByReferenceId(referenceId) {
    return prisma.transaction.findUnique({
      where: { referenceId },
      include: {
        sourceAccount: {
          select: {
            id: true,
            accountNumber: true,
            userId: true,
            type: true,
            currency: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        targetAccount: {
          select: {
            id: true,
            accountNumber: true,
            userId: true,
            type: true,
            currency: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        ledgerEntries: {
          orderBy: { createdAt: 'asc' },
        },
        outboxEvents: {
          select: { id: true, eventType: true, status: true, createdAt: true },
        },
      },
    });
  }

  /**
   * Create an initial Transaction record in PENDING status
   */
  async createPendingTransaction({
    idempotencyKey,
    referenceId,
    sourceAccountId,
    targetAccountId,
    amount,
    currency,
    description,
  }) {
    return prisma.transaction.create({
      data: {
        idempotencyKey,
        referenceId,
        sourceAccountId,
        targetAccountId,
        amount: Number(amount),
        currency,
        type: 'TRANSFER',
        status: 'PENDING',
        description,
      },
    });
  }

  /**
   * Finalize transaction on successful ledger write inside a PostgreSQL ACID transaction:
   * 1. Updates Transaction status to COMPLETED
   * 2. Creates OutboxEvent record (Transactional Outbox Pattern)
   * 3. Creates AuditLog record
   */
  async finalizeSuccessfulTransaction({
    transactionId,
    referenceId,
    sourceAccountId,
    targetAccountId,
    amount,
    currency,
    userId,
    email,
    recipient,
    ipAddress,
    userAgent,
  }) {
    const userEmail = email || recipient || undefined;
    return prisma.$transaction(async (tx) => {
      // 1. Update Transaction status to COMPLETED
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
        },
      });

      // 2. Create OutboxEvent record for Transactional Outbox pattern
      const outboxEvent = await tx.outboxEvent.create({
        data: {
          aggregateType: 'TRANSACTION',
          aggregateId: transactionId,
          eventType: 'PAYMENT_COMPLETED',
          transactionId,
          status: 'PENDING',
          payload: {
            transactionId,
            referenceId,
            sourceAccountId,
            targetAccountId,
            amount: Number(amount),
            currency,
            userId,
            email: userEmail,
            recipient: userEmail,
            routingKey: 'payment.completed',
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 3. Create AuditLog entry for compliance
      const auditLog = await tx.auditLog.create({
        data: {
          userId,
          action: 'PAYMENT_TRANSFER',
          entity: 'Transaction',
          entityId: transactionId,
          ipAddress,
          userAgent,
          metadata: {
            referenceId,
            amount: Number(amount),
            currency,
            sourceAccountId,
            targetAccountId,
          },
        },
      });

      return { transaction: updatedTransaction, outboxEvent, auditLog };
    });
  }

  /**
   * Record outbox event and audit log for deposit or withdrawal operations
   */
  async recordOperationOutbox({
    transactionId,
    referenceId,
    eventType,
    accountId,
    accountNumber,
    amount,
    currency,
    userId,
    email,
    action,
    ipAddress = null,
    userAgent = null,
  }) {
    return prisma.$transaction(async (tx) => {
      const outboxEvent = await tx.outboxEvent.create({
        data: {
          aggregateType: 'TRANSACTION',
          aggregateId: transactionId || referenceId,
          eventType: eventType || 'PAYMENT_COMPLETED',
          transactionId: transactionId || null,
          status: 'PENDING',
          payload: {
            transactionId,
            referenceId,
            accountId,
            accountNumber,
            amount: Number(amount),
            currency,
            userId,
            email,
            recipient: email,
            routingKey: 'payment.completed',
            timestamp: new Date().toISOString(),
          },
        },
      });

      let auditLog = null;
      if (userId) {
        auditLog = await tx.auditLog.create({
          data: {
            userId,
            action: action || 'PAYMENT_OPERATION',
            entity: 'Transaction',
            entityId: transactionId || referenceId,
            ipAddress,
            userAgent,
            metadata: {
              referenceId,
              amount: Number(amount),
              currency,
              accountNumber,
            },
          },
        });
      }

      return { outboxEvent, auditLog };
    });
  }

  /**
   * Mark transaction as FAILED with error reason
   */
  async markTransactionFailed(transactionId, failureReason) {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'FAILED',
        failureReason,
      },
    });
  }

  /**
   * Build Prisma where clause with role-based scoping and filters
   */
  async buildTransactionWhereClause(userContext, filters = {}) {
    const { userId, role } = userContext;
    const { status, type, startDate, endDate, minAmount, maxAmount, referenceId, accountNumber } =
      filters;

    const where = {};

    // 1. Role-based scoping
    if (role !== 'ADMIN' && role !== 'TELLER') {
      where.OR = [
        { sourceAccount: { userId, deletedAt: null } },
        { targetAccount: { userId, deletedAt: null } },
      ];
    } else if (filters.userId) {
      where.OR = [
        { sourceAccount: { userId: filters.userId, deletedAt: null } },
        { targetAccount: { userId: filters.userId, deletedAt: null } },
      ];
    }

    // 2. Specific Account Number filter
    if (accountNumber) {
      const accFilter = [
        { sourceAccount: { accountNumber } },
        { targetAccount: { accountNumber } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: accFilter }];
        delete where.OR;
      } else {
        where.OR = accFilter;
      }
    }

    // 3. Status filter
    if (status) {
      where.status = status;
    }

    // 4. Type / Category filter
    if (type) {
      where.type = type;
    }

    // 5. Amount Range filter
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) where.amount.gte = minAmount;
      if (maxAmount !== undefined) where.amount.lte = maxAmount;
    }

    // 6. Date Range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // 7. Reference ID search (case-insensitive substring)
    if (referenceId) {
      where.referenceId = {
        contains: referenceId,
        mode: 'insensitive',
      };
    }

    return where;
  }

  /**
   * Cursor-paginated transactions with total count and metadata
   */
  async getPaginatedTransactions(userContext, filters = {}) {
    const limit = filters.limit ? parseInt(filters.limit, 10) : 20;
    const { cursor } = filters;

    const where = await this.buildTransactionWhereClause(userContext, filters);

    // Fetch total count and items matching filters
    const [totalCount, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          sourceAccount: {
            select: {
              accountNumber: true,
              type: true,
              currency: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          targetAccount: {
            select: {
              accountNumber: true,
              type: true,
              currency: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          ledgerEntries: {
            select: { id: true, type: true, amount: true, balanceAfter: true, createdAt: true },
          },
        },
      }),
    ]);

    let nextCursor = null;
    let hasMore = false;

    if (items.length > limit) {
      hasMore = true;
      const nextItem = items.pop();
      nextCursor = nextItem.id;
    }

    return {
      transactions: items,
      pagination: {
        limit,
        totalCount,
        hasMore,
        nextCursor,
      },
    };
  }

  /**
   * Calculate financial dashboard summary and monthly volumes
   */
  async getFinancialSummary(userContext, filters = {}) {
    const { userId, role } = userContext;
    const { startDate, endDate, accountNumber, currency = 'USD' } = filters;

    const baseWhere = await this.buildTransactionWhereClause(userContext, {
      startDate,
      endDate,
      accountNumber,
    });

    // 1. Fetch transactions for calculation
    const allTransactions = await prisma.transaction.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceAccountId: true,
        targetAccountId: true,
        sourceAccount: { select: { userId: true, accountNumber: true } },
        targetAccount: { select: { userId: true, accountNumber: true } },
        amount: true,
        currency: true,
        status: true,
        type: true,
        createdAt: true,
      },
    });

    let totalSent = 0;
    let totalReceived = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let lastTransactionAt = null;

    if (allTransactions.length > 0) {
      lastTransactionAt = allTransactions[0].createdAt;
    }

    const monthlyMap = new Map();

    for (const tx of allTransactions) {
      const amt = Number(tx.amount);
      const isSender =
        role === 'ADMIN' || role === 'TELLER'
          ? accountNumber
            ? tx.sourceAccount?.accountNumber === accountNumber
            : true
          : tx.sourceAccount?.userId === userId;

      const isReceiver =
        role === 'ADMIN' || role === 'TELLER'
          ? accountNumber
            ? tx.targetAccount?.accountNumber === accountNumber
            : false
          : tx.targetAccount?.userId === userId;

      if (tx.status === 'COMPLETED') {
        totalSuccessful++;

        if (isSender && !isReceiver) {
          totalSent += amt;
        } else if (isReceiver && !isSender) {
          totalReceived += amt;
        } else if (isSender && isReceiver) {
          // Internal transfer between user's own accounts
          totalSent += amt;
          totalReceived += amt;
        }

        // Monthly grouping (YYYY-MM)
        const monthKey = tx.createdAt.toISOString().slice(0, 7);
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { month: monthKey, sent: 0, received: 0, total: 0, count: 0 });
        }
        const mData = monthlyMap.get(monthKey);
        mData.count++;
        if (isSender) mData.sent += amt;
        if (isReceiver) mData.received += amt;
        mData.total += amt;
      } else if (tx.status === 'FAILED') {
        totalFailed++;
      }
    }

    const totalVolume = totalSent + totalReceived;

    // Convert monthly map to sorted array (newest month first)
    const monthlyVolume = Array.from(monthlyMap.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((m) => ({
        month: m.month,
        sent: Number(m.sent.toFixed(2)),
        received: Number(m.received.toFixed(2)),
        total: Number(m.total.toFixed(2)),
        count: m.count,
      }));

    return {
      currency,
      totalSent: Number(totalSent.toFixed(2)),
      totalReceived: Number(totalReceived.toFixed(2)),
      totalVolume: Number(totalVolume.toFixed(2)),
      totalSuccessful,
      totalFailed,
      totalTransactions: allTransactions.length,
      lastTransactionAt,
      monthlyVolume,
    };
  }
}
