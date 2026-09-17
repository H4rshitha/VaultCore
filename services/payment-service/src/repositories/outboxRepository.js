import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class OutboxRepository {
  /**
   * Fetch pending outbox events ordered oldest first
   */
  async fetchPendingEvents(limit = 50) {
    return prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
      },
      take: limit,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Mark event as PUBLISHED with processedAt timestamp
   */
  async markEventPublished(eventId) {
    return prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'PUBLISHED',
        processedAt: new Date(),
        error: null,
      },
    });
  }

  /**
   * Increment retry count and record error message
   */
  async incrementRetry(eventId, errorMessage, retryCount) {
    return prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        retryCount,
        error: errorMessage,
      },
    });
  }

  /**
   * Mark event as FAILED when max retries exceeded
   */
  async markEventFailed(eventId, errorMessage, retryCount) {
    return prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'FAILED',
        retryCount,
        error: errorMessage,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Retrieve outbox monitoring statistics and status counts
   */
  async getOutboxStatus() {
    const [pendingCount, publishedCount, failedCount, recentFailedEvents, recentPendingEvents] =
      await Promise.all([
        prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
        prisma.outboxEvent.count({ where: { status: 'PUBLISHED' } }),
        prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
        prisma.outboxEvent.findMany({
          where: { status: 'FAILED' },
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.outboxEvent.findMany({
          where: { status: 'PENDING' },
          take: 10,
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    return {
      statusCounts: {
        pending: pendingCount,
        published: publishedCount,
        failed: failedCount,
        total: pendingCount + publishedCount + failedCount,
      },
      recentPending: recentPendingEvents,
      recentFailed: recentFailedEvents,
    };
  }
}
