import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class NotificationRepository {
  /**
   * Find notification audit record by unique event ID (for idempotency check)
   */
  async findByEventId(eventId) {
    return prisma.notificationAudit.findUnique({
      where: { eventId },
    });
  }

  /**
   * Create an immutable audit log record for a processed notification
   */
  async createAudit({
    eventId,
    transactionId,
    notificationType = 'EMAIL',
    recipient,
    status = 'SENT',
    retryCount = 0,
    errorMessage = null,
    traceId = null,
    payload = null,
  }) {
    return prisma.notificationAudit.create({
      data: {
        eventId,
        transactionId,
        notificationType,
        recipient,
        status,
        retryCount,
        errorMessage,
        traceId,
        payload: payload || {},
        processedAt: new Date(),
      },
    });
  }

  /**
   * Update notification audit status and error on retry or final failure
   */
  async updateAuditStatus(eventId, { status, retryCount, errorMessage, processedAt = new Date() }) {
    return prisma.notificationAudit.update({
      where: { eventId },
      data: {
        status,
        retryCount,
        errorMessage,
        processedAt,
      },
    });
  }

  /**
   * Fetch paginated notification history with filters
   */
  async getPaginatedHistory(filters = {}) {
    const limit = filters.limit ? parseInt(filters.limit, 10) : 20;
    const { cursor, recipient, status, type, startDate, endDate, transactionId } = filters;

    const where = {};

    if (recipient) {
      where.recipient = recipient;
    }

    if (transactionId) {
      where.transactionId = transactionId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.notificationType = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalCount, items] = await Promise.all([
      prisma.notificationAudit.count({ where }),
      prisma.notificationAudit.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
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
      notifications: items,
      pagination: {
        limit,
        totalCount,
        hasMore,
        nextCursor,
      },
    };
  }

  /**
   * Get admin aggregated statistics
   */
  async getAdminStatistics() {
    const [sentCount, failedCount, pendingCount, deliveredCount, recentFailed] =
      await Promise.all([
        prisma.notificationAudit.count({ where: { status: 'SENT' } }),
        prisma.notificationAudit.count({ where: { status: 'FAILED' } }),
        prisma.notificationAudit.count({ where: { status: 'PENDING' } }),
        prisma.notificationAudit.count({ where: { status: 'DELIVERED' } }),
        prisma.notificationAudit.findMany({
          where: { status: 'FAILED' },
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    return {
      sent: sentCount,
      failed: failedCount,
      pending: pendingCount,
      delivered: deliveredCount,
      total: sentCount + failedCount + pendingCount + deliveredCount,
      recentFailed,
    };
  }
}
