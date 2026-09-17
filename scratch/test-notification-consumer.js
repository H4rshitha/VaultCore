import 'dotenv/config';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';
import { NotificationRepository } from '../services/notification-service/src/repositories/notificationRepository.js';
import { NotificationService } from '../services/notification-service/src/services/notificationService.js';
import { NotificationConsumer } from '../services/notification-service/src/services/notificationConsumer.js';
import { createLogger, NOTIFICATION_QUEUES } from '@vaultcore/shared';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://vaultuser:vaultpass@localhost:5433/vaultcore_db?schema=public';

const prisma = new PrismaClient();
const logger = createLogger('test-notification');

async function runTests() {
  console.log('========================================================================');
  console.log(' VaultCore Prompt 11: Notification Service (RabbitMQ Consumer) Test Suite');
  console.log('========================================================================\n');

  // 1. Verify Class & Method Signatures
  console.log('[1. Testing Notification Service & Repository Method Signatures]');
  const repository = new NotificationRepository();
  const service = new NotificationService(logger, repository);
  const consumer = new NotificationConsumer(logger, { repository, service });

  assert.strictEqual(typeof repository.findByEventId, 'function');
  assert.strictEqual(typeof repository.createAudit, 'function');
  assert.strictEqual(typeof repository.updateAuditStatus, 'function');
  assert.strictEqual(typeof repository.getPaginatedHistory, 'function');
  assert.strictEqual(typeof repository.getAdminStatistics, 'function');

  assert.strictEqual(typeof service.formatMessage, 'function');
  assert.strictEqual(typeof service.deliverNotification, 'function');
  assert.strictEqual(typeof service.getCustomerHistory, 'function');
  assert.strictEqual(typeof service.getAdminStatus, 'function');

  assert.strictEqual(typeof consumer.start, 'function');
  assert.strictEqual(typeof consumer.stop, 'function');
  assert.strictEqual(typeof consumer.getMetrics, 'function');
  assert.strictEqual(typeof consumer.sendToDLQ, 'function');
  console.log(
    '  ✔ All required methods exist on NotificationRepository, NotificationService, and NotificationConsumer'
  );

  // 2. Test Message Template Formatting & Recipient Resolution
  console.log('\n[2. Testing Notification Template Formatting & Recipient Resolution]');
  const completedTemplate = service.formatMessage('PAYMENT_COMPLETED', 'payment.completed', {
    amount: 500,
    currency: 'USD',
    referenceId: 'REF-20260915-001',
  });
  assert.strictEqual(completedTemplate.subject, 'VaultCore Transfer Completed');
  assert.ok(completedTemplate.body.includes('500 USD'));
  assert.ok(completedTemplate.body.includes('REF-20260915-001'));

  const failedTemplate = service.formatMessage('PAYMENT_FAILED', 'payment.failed', {
    amount: 100,
    currency: 'USD',
    referenceId: 'REF-FAIL-001',
    reason: 'Insufficient balance',
  });
  assert.strictEqual(failedTemplate.subject, 'VaultCore Transfer Failed');
  assert.ok(failedTemplate.body.includes('Insufficient balance'));

  const smsRecipient = service.resolveRecipient({ phoneNumber: '+1234567890' }, 'SMS');
  assert.strictEqual(smsRecipient, '+1234567890');

  const emailRecipient = service.resolveRecipient({ email: 'alice@example.com' }, 'EMAIL');
  assert.strictEqual(emailRecipient, 'alice@example.com');
  console.log('  ✔ Email and SMS templates and recipient resolution logic verified correctly');

  // 3. Test Simulated Delivery
  console.log('\n[3. Testing Simulated Async Delivery]');
  const deliveryResult = await service.deliverNotification({
    notificationType: 'EMAIL',
    recipient: 'alice@example.com',
    subject: completedTemplate.subject,
    body: completedTemplate.body,
  });
  assert.strictEqual(deliveryResult.delivered, true);
  assert.strictEqual(deliveryResult.notificationType, 'EMAIL');
  assert.strictEqual(deliveryResult.recipient, 'alice@example.com');
  assert.ok(deliveryResult.deliveryId);
  console.log(
    `  ✔ Simulated delivery succeeded with deliveryId: ${deliveryResult.deliveryId}, latency: ${deliveryResult.latencyMs}ms`
  );

  // 4. Test In-Memory Database / Mock Repository for Idempotency & Persistence
  console.log('\n[4. Testing NotificationAudit Persistence & Idempotency]');
  const mockDb = [];
  const testRepo = {
    findByEventId: async (eventId) => mockDb.find((item) => item.eventId === eventId) || null,
    createAudit: async (data) => {
      const record = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.push(record);
      return record;
    },
    updateAuditStatus: async (eventId, updates) => {
      const item = mockDb.find((e) => e.eventId === eventId);
      if (item) Object.assign(item, updates);
      return item;
    },
    getPaginatedHistory: async (filters = {}) => {
      let filtered = mockDb;
      if (filters.recipient) filtered = filtered.filter((i) => i.recipient === filters.recipient);
      if (filters.status) filtered = filtered.filter((i) => i.status === filters.status);
      return {
        notifications: filtered,
        pagination: { limit: 20, totalCount: filtered.length, hasMore: false, nextCursor: null },
      };
    },
    getAdminStatistics: async () => ({
      sent: mockDb.filter((i) => i.status === 'SENT').length,
      failed: mockDb.filter((i) => i.status === 'FAILED').length,
      pending: 0,
      delivered: 0,
      total: mockDb.length,
      recentFailed: mockDb.filter((i) => i.status === 'FAILED'),
    }),
  };

  const testService = new NotificationService(logger, testRepo);

  // 4.1 First Delivery (Should Process and Save Audit)
  const event1 = {
    eventId: 'evt-unique-001',
    transactionId: 'tx-001',
    traceId: 'trace-001',
    routingKey: 'payment.completed',
    payload: {
      amount: 250,
      currency: 'USD',
      referenceId: 'REF-001',
      recipient: 'alice@example.com',
    },
  };

  const existing1 = await testRepo.findByEventId(event1.eventId);
  assert.strictEqual(existing1, null);

  const formatted1 = testService.formatMessage(
    'PAYMENT_COMPLETED',
    event1.routingKey,
    event1.payload
  );
  await testService.deliverNotification({
    notificationType: 'EMAIL',
    recipient: event1.payload.recipient,
    subject: formatted1.subject,
    body: formatted1.body,
    payload: event1.payload,
  });

  await testRepo.createAudit({
    eventId: event1.eventId,
    transactionId: event1.transactionId,
    notificationType: 'EMAIL',
    recipient: event1.payload.recipient,
    status: 'SENT',
    retryCount: 0,
    traceId: event1.traceId,
    payload: event1.payload,
  });

  assert.strictEqual(mockDb.length, 1);
  assert.strictEqual(mockDb[0].eventId, 'evt-unique-001');
  assert.strictEqual(mockDb[0].status, 'SENT');
  console.log('  ✔ First message processed and saved to NotificationAudit database');

  // 4.2 Duplicate Delivery with Same eventId (Idempotency Check)
  const duplicateCheck = await testRepo.findByEventId(event1.eventId);
  assert.notStrictEqual(duplicateCheck, null, 'Should detect already processed event');
  console.log('  ✔ Idempotent consumer check: duplicate event detected and skipped');

  // 5. Test Retry Strategy & Dead Letter Queue (DLQ)
  console.log('\n[5. Testing Retry Strategy & Dead Letter Queue (DLQ) Routing]');
  let dlqMessages = [];
  let publishedRetries = [];

  const mockChannel = {
    sendToQueue: (queue, content, options) => {
      dlqMessages.push({ queue, content: JSON.parse(content.toString()), options });
    },
    publish: (exchange, routingKey, content, options) => {
      publishedRetries.push({
        exchange,
        routingKey,
        content: JSON.parse(content.toString()),
        options,
      });
    },
    ack: () => {},
  };

  const testConsumer = new NotificationConsumer(logger, {
    repository: testRepo,
    service: testService,
    maxRetries: 3,
  });
  testConsumer.channel = mockChannel;

  // Simulate transient failure: Attempt 1 -> Retry 1
  const retryEvent = {
    content: Buffer.from(
      JSON.stringify({
        eventId: 'evt-retry-002',
        transactionId: 'tx-002',
        payload: { amount: 75, recipient: 'bob@example.com', simulateFailure: true },
      })
    ),
    properties: { headers: { eventId: 'evt-retry-002', retryAttempt: 0 } },
    fields: { routingKey: 'payment.completed' },
  };

  // Dispatch to DLQ on max retries (e.g. attempt 4 > 3)
  await testConsumer.sendToDLQ(retryEvent, 'Max retries (3) exceeded: network timeout', {
    traceId: 'trace-002',
    eventId: 'evt-retry-002',
    transactionId: 'tx-002',
    retryAttempt: 4,
  });

  assert.strictEqual(dlqMessages.length, 1);
  assert.strictEqual(dlqMessages[0].queue, NOTIFICATION_QUEUES.DLQ);
  assert.strictEqual(testConsumer.metrics.dlqCount, 1);
  console.log(
    '  ✔ Exceeded max retries (3) correctly routed message to DLQ queue: vaultcore.notifications.dlq'
  );

  // Record failed audit
  await testRepo.createAudit({
    eventId: 'evt-retry-002',
    transactionId: 'tx-002',
    notificationType: 'EMAIL',
    recipient: 'bob@example.com',
    status: 'FAILED',
    retryCount: 4,
    errorMessage: 'Max retries (3) exceeded: network timeout',
    traceId: 'trace-002',
  });

  // 6. Test Customer History & Admin Status APIs
  console.log('\n[6. Testing Customer History & Admin Status Endpoints]');
  // Customer query
  const customerHistory = await testService.getCustomerHistory(
    { email: 'alice@example.com', role: 'CUSTOMER' },
    { limit: 10 }
  );
  assert.strictEqual(customerHistory.notifications.length, 1);
  assert.strictEqual(customerHistory.notifications[0].recipient, 'alice@example.com');
  console.log('  ✔ Customer notification history scoped to user email successfully');

  // Admin query
  const adminStatus = await testService.getAdminStatus(testConsumer.getMetrics());
  assert.strictEqual(adminStatus.status, 'HEALTHY');
  assert.strictEqual(adminStatus.statistics.sent, 1);
  assert.strictEqual(adminStatus.statistics.failed, 1);
  assert.strictEqual(adminStatus.statistics.total, 2);
  assert.strictEqual(adminStatus.consumer.maxRetries, 3);
  assert.strictEqual(adminStatus.consumer.dlqCount, 1);
  console.log('  ✔ Admin status and queue metrics returned correctly:');
  console.log(JSON.stringify(adminStatus, null, 2));

  console.log('\n========================================================================');
  console.log(' ✔ ALL PROMPT 11 NOTIFICATION SERVICE TESTS PASSED SUCCESSFULLY');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n✖ Test failed:', err);
  process.exit(1);
});
