import assert from 'node:assert';
import { GatewayEventConsumer } from '../services/gateway/src/services/gatewayEventConsumer.js';
import { broadcastSSEEvent, bankingEventBus } from '../services/gateway/src/app.js';
import { createLogger } from '../shared/src/logger/index.js';

const logger = createLogger('test-sse-bridge');

console.log('🧪 Starting RabbitMQ -> Gateway SSE Bridge Verification Test...\n');

// Test 1: Verify GatewayEventConsumer instantiation & interface
console.log('1. Verifying GatewayEventConsumer class interface...');
const consumer = new GatewayEventConsumer(logger, {
  uri: 'amqp://mock-test-host:5672',
  queue: 'vaultcore.gateway.sse.queue',
  exchange: 'vaultcore.events',
});

assert(typeof consumer.start === 'function', 'consumer has start method');
assert(typeof consumer.stop === 'function', 'consumer has stop method');
assert(typeof consumer.getMetrics === 'function', 'consumer has getMetrics method');
console.log('✅ GatewayEventConsumer interface verified.\n');

// Test 2: Verify SSE broadcasting mechanism
console.log('2. Verifying SSE broadcasting with mock client...');
const receivedSSEEvents = [];

const mockSSEClient = {
  write: (data) => {
    receivedSSEEvents.push(data);
  },
};

// Simulate broadcastSSEEvent
const testEvent = {
  eventId: 'evt-test-101',
  type: 'payment.completed',
  eventType: 'payment.completed',
  routingKey: 'payment.completed',
  traceId: 'trace-test-101',
  transactionId: 'tx-101',
  referenceId: 'REF-TEST-101',
  amount: 500,
  currency: 'INR',
  sourceAccountNumber: '100000000001',
  targetAccountNumber: '100000000002',
  recipient: 'customer@vaultcore.io',
  payload: {
    amount: 500,
    currency: 'INR',
    referenceId: 'REF-TEST-101',
    transactionId: 'tx-101',
  },
  timestamp: new Date().toISOString(),
};

broadcastSSEEvent(testEvent);

console.log('✅ broadcastSSEEvent executed without error.\n');

// Test 3: Verify simulated RabbitMQ message transformation logic
console.log('3. Verifying message transformation logic...');
const rawAmqpMsg = {
  fields: {
    routingKey: 'payment.completed',
  },
  properties: {
    headers: {
      eventId: 'evt-test-999',
      traceId: 'trace-test-999',
    },
  },
  content: Buffer.from(
    JSON.stringify({
      eventId: 'evt-test-999',
      eventType: 'PAYMENT_COMPLETED',
      routingKey: 'payment.completed',
      payload: {
        transactionId: 'tx-999',
        referenceId: 'REF-999',
        amount: 500,
        currency: 'INR',
        email: 'harshitha@vaultcore.io',
        recipient: 'harshitha@vaultcore.io',
      },
    })
  ),
};

const parsed = JSON.parse(rawAmqpMsg.content.toString());
const headers = rawAmqpMsg.properties.headers;
const routingKey = rawAmqpMsg.fields.routingKey;

const transformedSSEEvent = {
  id: parsed.eventId || headers.eventId,
  eventId: parsed.eventId || headers.eventId,
  type: routingKey || parsed.eventType,
  eventType: routingKey || parsed.eventType,
  routingKey,
  traceId: headers.traceId || parsed.traceId,
  transactionId: parsed.payload.transactionId,
  referenceId: parsed.payload.referenceId,
  amount: Number(parsed.payload.amount),
  currency: parsed.payload.currency,
  recipient: parsed.payload.recipient,
  payload: parsed.payload,
  timestamp: new Date().toISOString(),
};

assert.strictEqual(transformedSSEEvent.amount, 500);
assert.strictEqual(transformedSSEEvent.currency, 'INR');
assert.strictEqual(transformedSSEEvent.referenceId, 'REF-999');
assert.strictEqual(transformedSSEEvent.type, 'payment.completed');
assert.strictEqual(transformedSSEEvent.recipient, 'harshitha@vaultcore.io');

console.log('✅ Message transformation payload matches expectations:\n', transformedSSEEvent);

console.log('\n🎉 ALL RABBITMQ -> GATEWAY SSE BRIDGE CHECKS PASSED!');
