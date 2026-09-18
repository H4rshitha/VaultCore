import 'dotenv/config';
import assert from 'node:assert';
import { OutboxRepository } from '../services/payment-service/src/repositories/outboxRepository.js';
import { OutboxPublisher } from '../services/payment-service/src/services/outboxPublisher.js';
import { OutboxWorker } from '../services/payment-service/src/services/outboxWorker.js';
import { RabbitMQClient, createLogger } from '@vaultcore/shared';
import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://vaultcore:vaultcore_password@localhost:5433/vaultcore_db?schema=public';

const prisma = new PrismaClient();
const logger = createLogger('test-outbox');

async function runTests() {
  console.log('========================================================================');
  console.log(' VaultCore Prompt 10: RabbitMQ + Transactional Outbox Pattern Test Suite');
  console.log('========================================================================\n');

  // 1. Verify Class & Method Signatures
  console.log('[1. Testing Outbox Class Signatures & Architecture]');
  const outboxRepo = new OutboxRepository();
  const publisher = new OutboxPublisher(logger);
  const worker = new OutboxWorker(logger);

  assert.strictEqual(typeof outboxRepo.fetchPendingEvents, 'function');
  assert.strictEqual(typeof outboxRepo.markEventPublished, 'function');
  assert.strictEqual(typeof outboxRepo.incrementRetry, 'function');
  assert.strictEqual(typeof outboxRepo.markEventFailed, 'function');
  assert.strictEqual(typeof outboxRepo.getOutboxStatus, 'function');

  assert.strictEqual(typeof publisher.init, 'function');
  assert.strictEqual(typeof publisher.publish, 'function');
  assert.strictEqual(typeof publisher.close, 'function');

  assert.strictEqual(typeof worker.start, 'function');
  assert.strictEqual(typeof worker.stop, 'function');
  assert.strictEqual(typeof worker.processBatch, 'function');
  assert.strictEqual(typeof worker.getStatus, 'function');
  assert.strictEqual(typeof worker.calculateBackoffMs, 'function');
  console.log(
    '  ✔ All required methods exist on OutboxRepository, OutboxPublisher, and OutboxWorker'
  );

  // 2. Test Exponential Backoff Calculation
  console.log('\n[2. Testing Exponential Backoff Calculation]');
  assert.strictEqual(worker.calculateBackoffMs(0), 1000); // 1000 * 2^0 = 1000ms (1s)
  assert.strictEqual(worker.calculateBackoffMs(1), 2000); // 1000 * 2^1 = 2000ms (2s)
  assert.strictEqual(worker.calculateBackoffMs(2), 4000); // 1000 * 2^2 = 4000ms (4s)
  assert.strictEqual(worker.calculateBackoffMs(3), 8000); // 1000 * 2^3 = 8000ms (8s)
  assert.strictEqual(worker.calculateBackoffMs(4), 16000); // 1000 * 2^4 = 16000ms (16s)
  assert.strictEqual(worker.calculateBackoffMs(5), 30000); // capped at 30000ms (30s)
  console.log(
    '  ✔ Exponential backoff correctly calculates 1s -> 2s -> 4s -> 8s -> 16s -> 30s max'
  );

  // 3. Test In-Memory State Machine & Polling with Mock Repository & Publisher
  console.log('\n[3. Testing OutboxWorker Polling & Publishing Flow]');
  const mockDb = [
    {
      id: 'event-1',
      aggregateType: 'TRANSACTION',
      aggregateId: 'tx-101',
      eventType: 'PAYMENT_COMPLETED',
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date('2026-09-15T12:00:00Z'),
      updatedAt: new Date('2026-09-15T12:00:00Z'),
      payload: {
        transactionId: 'tx-101',
        referenceId: 'REF-2026-101',
        amount: 500,
        currency: 'USD',
        routingKey: 'payment.completed',
        traceId: 'trace-101',
      },
    },
    {
      id: 'event-2',
      aggregateType: 'TRANSACTION',
      aggregateId: 'tx-102',
      eventType: 'PAYMENT_FAILED',
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date('2026-09-15T12:01:00Z'),
      updatedAt: new Date('2026-09-15T12:01:00Z'),
      payload: {
        transactionId: 'tx-102',
        referenceId: 'REF-2026-102',
        amount: 250,
        currency: 'USD',
        routingKey: 'payment.failed',
        traceId: 'trace-102',
      },
    },
  ];

  const publishedMessages = [];
  const mockPublisher = {
    init: async () => {},
    publish: async (event, traceId) => {
      if (event.payload?.fail) {
        throw new Error('Connection refused to RabbitMQ');
      }
      publishedMessages.push({ eventId: event.id, routingKey: event.payload.routingKey, traceId });
      return { success: true, latencyMs: 15 };
    },
    close: async () => {},
  };

  const mockRepo = {
    fetchPendingEvents: async () => mockDb.filter((e) => e.status === 'PENDING'),
    markEventPublished: async (id) => {
      const item = mockDb.find((e) => e.id === id);
      if (item) {
        item.status = 'PUBLISHED';
        item.processedAt = new Date();
      }
      return item;
    },
    incrementRetry: async (id, error, retryCount) => {
      const item = mockDb.find((e) => e.id === id);
      if (item) {
        item.retryCount = retryCount;
        item.error = error;
        item.updatedAt = new Date();
      }
      return item;
    },
    markEventFailed: async (id, error, retryCount) => {
      const item = mockDb.find((e) => e.id === id);
      if (item) {
        item.status = 'FAILED';
        item.retryCount = retryCount;
        item.error = error;
        item.processedAt = new Date();
      }
      return item;
    },
    getOutboxStatus: async () => ({
      statusCounts: {
        pending: mockDb.filter((e) => e.status === 'PENDING').length,
        published: mockDb.filter((e) => e.status === 'PUBLISHED').length,
        failed: mockDb.filter((e) => e.status === 'FAILED').length,
        total: mockDb.length,
      },
      recentPending: mockDb.filter((e) => e.status === 'PENDING'),
      recentFailed: mockDb.filter((e) => e.status === 'FAILED'),
    }),
  };

  const testWorker = new OutboxWorker(logger, {
    repository: mockRepo,
    publisher: mockPublisher,
    pollIntervalMs: 2000,
    maxRetries: 5,
  });

  // Execute one polling cycle
  await testWorker.processBatch();

  assert.strictEqual(publishedMessages.length, 2);
  assert.strictEqual(publishedMessages[0].routingKey, 'payment.completed');
  assert.strictEqual(publishedMessages[1].routingKey, 'payment.failed');
  assert.strictEqual(mockDb[0].status, 'PUBLISHED');
  assert.strictEqual(mockDb[1].status, 'PUBLISHED');
  assert.ok(mockDb[0].processedAt);
  console.log(
    '  ✔ Pending events processed, published to RabbitMQ, and marked as PUBLISHED with timestamp'
  );

  // 4. Test Idempotency
  console.log('\n[4. Testing Idempotent Publishing (No Duplicate Publishing)]');
  const countBeforeSecondRun = publishedMessages.length;
  await testWorker.processBatch();
  assert.strictEqual(publishedMessages.length, countBeforeSecondRun);
  console.log('  ✔ Idempotent processing confirmed: already PUBLISHED events are skipped');

  // 5. Test Retry and Max Retries (5) -> FAILED
  console.log('\n[5. Testing Transient Error Retries & Permanent Failure Transition]');
  const failingEvent = {
    id: 'event-failing',
    aggregateType: 'TRANSACTION',
    aggregateId: 'tx-fail',
    eventType: 'PAYMENT_FAILED',
    status: 'PENDING',
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    payload: {
      transactionId: 'tx-fail',
      fail: true,
      routingKey: 'payment.failed',
    },
  };
  mockDb.push(failingEvent);

  // Run cycle 1 (retry 1)
  await testWorker.processBatch();
  assert.strictEqual(failingEvent.status, 'PENDING');
  assert.strictEqual(failingEvent.retryCount, 1);
  console.log(`  ✔ Attempt 1 failed -> retryCount incremented to ${failingEvent.retryCount}`);

  // Simulate retries up to 4
  failingEvent.retryCount = 4;
  failingEvent.updatedAt = new Date(Date.now() - 35000); // 35s ago so backoff passes

  // Run cycle for 5th attempt -> exceeds maxRetries (5) -> status becomes FAILED
  await testWorker.processBatch();
  assert.strictEqual(failingEvent.status, 'FAILED');
  assert.strictEqual(failingEvent.retryCount, 5);
  assert.strictEqual(failingEvent.error, 'Connection refused to RabbitMQ');
  console.log('  ✔ 5th failed attempt -> status transitioned to FAILED with error reason');

  // 6. Test Outbox Status API Response
  console.log('\n[6. Testing Outbox Status API Data]');
  const statusResult = await testWorker.getStatus();
  assert.strictEqual(statusResult.outboxDatabase.statusCounts.published, 2);
  assert.strictEqual(statusResult.outboxDatabase.statusCounts.failed, 1);
  assert.strictEqual(statusResult.outboxDatabase.statusCounts.pending, 0);
  assert.strictEqual(statusResult.worker.maxRetries, 5);
  assert.strictEqual(statusResult.worker.pollIntervalMs, 2000);
  console.log(
    '  ✔ Status endpoint data structured properly with pending, published, and failed metrics:'
  );
  console.log(JSON.stringify(statusResult, null, 2));

  console.log('\n========================================================================');
  console.log(' ✔ ALL PROMPT 10 RABBITMQ + OUTBOX TESTS PASSED SUCCESSFULLY');
  console.log('========================================================================\n');
}

runTests()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n✖ Test failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
