import client from 'prom-client';
import { circuitBreakerRegistry } from '../resilience/circuitBreaker.js';
import { CIRCUIT_STATES } from '../constants/index.js';

// Global default Prometheus registry
export const register = new client.Registry();

// Enable default Node.js runtime and system metrics
client.collectDefaultMetrics({ register, prefix: 'vaultcore_' });

// ==========================================
// 1. HTTP & API Gateway Metrics
// ==========================================
export const httpRequestsTotal = new client.Counter({
  name: 'vaultcore_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'path', 'status_code', 'service'],
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'vaultcore_http_request_duration_seconds',
  help: 'HTTP request duration in seconds (latency histogram)',
  labelNames: ['method', 'path', 'status_code', 'service'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpErrorsTotal = new client.Counter({
  name: 'vaultcore_http_errors_total',
  help: 'Total number of HTTP error responses returned',
  labelNames: ['method', 'path', 'status_code', 'service'],
  registers: [register],
});

export const httpActiveRequests = new client.Gauge({
  name: 'vaultcore_http_active_requests',
  help: 'Number of active HTTP requests currently being processed',
  labelNames: ['service'],
  registers: [register],
});

// ==========================================
// 2. Redis Caching & Hit Ratio Metrics
// ==========================================
export const redisCacheHitsTotal = new client.Counter({
  name: 'vaultcore_redis_cache_hits_total',
  help: 'Total number of Redis cache hits',
  labelNames: ['service', 'key_prefix'],
  registers: [register],
});

export const redisCacheMissesTotal = new client.Counter({
  name: 'vaultcore_redis_cache_misses_total',
  help: 'Total number of Redis cache misses',
  labelNames: ['service', 'key_prefix'],
  registers: [register],
});

export const redisCacheHitRatio = new client.Gauge({
  name: 'vaultcore_redis_cache_hit_ratio',
  help: 'Current Redis cache hit ratio (hits / (hits + misses))',
  labelNames: ['service'],
  registers: [register],
});

export const redisWriteDurationSeconds = new client.Histogram({
  name: 'vaultcore_redis_write_duration_seconds',
  help: 'Redis write operation duration in seconds',
  labelNames: ['service'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5],
  registers: [register],
});

// ==========================================
// 3. Distributed Locking & Concurrency Metrics
// ==========================================
export const lockAcquisitionsTotal = new client.Counter({
  name: 'vaultcore_distributed_lock_acquisitions_total',
  help: 'Total distributed lock acquisition attempts',
  labelNames: ['service', 'status'], // status: 'success' | 'failure'
  registers: [register],
});

export const lockConflictsTotal = new client.Counter({
  name: 'vaultcore_distributed_lock_conflicts_total',
  help: 'Total distributed lock conflicts/contention encountered',
  labelNames: ['service'],
  registers: [register],
});

export const lockHoldDurationSeconds = new client.Histogram({
  name: 'vaultcore_distributed_lock_duration_seconds',
  help: 'Distributed lock hold duration in seconds',
  labelNames: ['service'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// ==========================================
// 4. RabbitMQ & Messaging Metrics
// ==========================================
export const rabbitmqPublishedEventsTotal = new client.Counter({
  name: 'vaultcore_rabbitmq_published_events_total',
  help: 'Total messages published to RabbitMQ exchange',
  labelNames: ['exchange', 'routing_key', 'status'],
  registers: [register],
});

export const rabbitmqPublishDurationSeconds = new client.Histogram({
  name: 'vaultcore_rabbitmq_publish_duration_seconds',
  help: 'RabbitMQ publish latency in seconds',
  labelNames: ['exchange', 'routing_key'],
  buckets: [0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

export const rabbitmqQueueDepth = new client.Gauge({
  name: 'vaultcore_rabbitmq_queue_depth',
  help: 'Current queue message backlog depth',
  labelNames: ['queue'],
  registers: [register],
});

export const rabbitmqDlqCount = new client.Counter({
  name: 'vaultcore_rabbitmq_dlq_count',
  help: 'Total dead letter queue messages routed to DLQ',
  labelNames: ['queue'],
  registers: [register],
});

// ==========================================
// 5. Outbox Worker Metrics
// ==========================================
export const outboxEventsPolledTotal = new client.Counter({
  name: 'vaultcore_outbox_events_polled_total',
  help: 'Total pending outbox events polled from database',
  registers: [register],
});

export const outboxEventsPublishedTotal = new client.Counter({
  name: 'vaultcore_outbox_events_published_total',
  help: 'Total outbox events successfully published to message broker',
  registers: [register],
});

export const outboxEventsFailedTotal = new client.Counter({
  name: 'vaultcore_outbox_events_failed_total',
  help: 'Total outbox events that failed publishing and triggered retry',
  registers: [register],
});

export const outboxBatchDurationSeconds = new client.Histogram({
  name: 'vaultcore_outbox_batch_duration_seconds',
  help: 'Duration of outbox worker polling & publishing batches in seconds',
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// ==========================================
// 6. Payment & Financial Domain Metrics
// ==========================================
export const paymentsProcessedTotal = new client.Counter({
  name: 'vaultcore_payments_processed_total',
  help: 'Total financial payment transactions orchestrated',
  labelNames: ['status', 'currency'], // status: 'COMPLETED' | 'FAILED' | 'PENDING'
  registers: [register],
});

export const paymentAmountTransferredTotal = new client.Counter({
  name: 'vaultcore_payment_amount_transferred_total',
  help: 'Total cumulative amount of funds transferred',
  labelNames: ['currency'],
  registers: [register],
});

export const paymentProcessingDurationSeconds = new client.Histogram({
  name: 'vaultcore_payment_processing_duration_seconds',
  help: 'End-to-end payment transfer orchestration duration in seconds',
  labelNames: ['status'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

// ==========================================
// 7. Ledger Service Metrics
// ==========================================
export const ledgerEntriesRecordedTotal = new client.Counter({
  name: 'vaultcore_ledger_entries_recorded_total',
  help: 'Total immutable double-entry ledger entries recorded',
  labelNames: ['type'], // 'DEBIT' | 'CREDIT'
  registers: [register],
});

export const ledgerTransactionDurationSeconds = new client.Histogram({
  name: 'vaultcore_ledger_transaction_duration_seconds',
  help: 'Ledger double-entry transaction database execution duration',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// ==========================================
// 8. Notification Service Metrics
// ==========================================
export const notificationsDispatchedTotal = new client.Counter({
  name: 'vaultcore_notifications_dispatched_total',
  help: 'Total notifications processed and dispatched',
  labelNames: ['type', 'status'], // type: 'EMAIL' | 'SMS', status: 'DELIVERED' | 'FAILED'
  registers: [register],
});

export const notificationDeliveryDurationSeconds = new client.Histogram({
  name: 'vaultcore_notification_delivery_duration_seconds',
  help: 'Notification delivery processing duration in seconds',
  labelNames: ['type'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// ==========================================
// 9. Circuit Breaker Metrics
// ==========================================
export const circuitBreakerStateGauge = new client.Gauge({
  name: 'vaultcore_circuit_breaker_state',
  help: 'Current state of circuit breaker (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
  labelNames: ['service'],
  registers: [register],
});

export const circuitBreakerFailFastCounter = new client.Counter({
  name: 'vaultcore_circuit_breaker_fail_fast_total',
  help: 'Total number of fast-failed requests blocked by OPEN circuit breaker',
  labelNames: ['service'],
  registers: [register],
});

export const circuitBreakerFailuresCounter = new client.Counter({
  name: 'vaultcore_circuit_breaker_failures_total',
  help: 'Total number of downstream failures recorded by circuit breaker',
  labelNames: ['service'],
  registers: [register],
});

export const circuitBreakerTransitionsCounter = new client.Counter({
  name: 'vaultcore_circuit_breaker_transitions_total',
  help: 'Total number of circuit breaker state transitions',
  labelNames: ['service', 'from_state', 'to_state'],
  registers: [register],
});

export const circuitBreakerRecoveriesCounter = new client.Counter({
  name: 'vaultcore_circuit_breaker_recoveries_total',
  help: 'Total number of successful circuit breaker recoveries',
  labelNames: ['service'],
  registers: [register],
});

// ==========================================
// Helper Functions & Middlewares
// ==========================================
export const normalizePath = (path = '') => {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d{10,16}/g, '/:accountNumber')
    .split('?')[0];
};

export const syncAllCircuitBreakers = () => {
  try {
    const breakers = circuitBreakerRegistry.getAll();
    for (const breaker of breakers) {
      const status = breaker.getStatus();
      const stateVal =
        status.state === CIRCUIT_STATES.CLOSED
          ? 0
          : status.state === CIRCUIT_STATES.HALF_OPEN
            ? 1
            : 2;

      circuitBreakerStateGauge.set({ service: breaker.name }, stateVal);
    }
  } catch {
    // Ignore sync errors
  }
};

/**
 * Creates Express middleware for tracking HTTP metrics per microservice
 */
export const createServiceMetricsMiddleware = (serviceName) => {
  return (req, res, next) => {
    if (req.path === '/metrics') {
      return next();
    }

    const startTime = process.hrtime();
    const normalized = normalizePath(req.path || req.originalUrl);

    httpActiveRequests.inc({ service: serviceName });

    res.on('finish', () => {
      httpActiveRequests.dec({ service: serviceName });

      const diff = process.hrtime(startTime);
      const durationSeconds = diff[0] + diff[1] / 1e9;
      const statusCode = res.statusCode ? res.statusCode.toString() : '500';

      const labels = {
        method: req.method,
        path: normalized,
        status_code: statusCode,
        service: serviceName,
      };

      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);

      if (res.statusCode >= 400) {
        httpErrorsTotal.inc(labels);
      }
    });

    next();
  };
};

/**
 * Creates standard Express /metrics endpoint handler
 */
export const metricsEndpointHandler = async (req, res) => {
  try {
    syncAllCircuitBreakers();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
};
