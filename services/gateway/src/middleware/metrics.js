import client from 'prom-client';
import { circuitBreakerRegistry, CIRCUIT_STATES } from '@vaultcore/shared';

// Create a custom Prometheus registry
const register = new client.Registry();

// Enable default Node.js and system metrics
client.collectDefaultMetrics({ register, prefix: 'vaultcore_' });

// Total HTTP Requests Counter
const httpRequestsTotal = new client.Counter({
  name: 'vaultcore_http_requests_total',
  help: 'Total number of HTTP requests processed by API Gateway',
  labelNames: ['method', 'path', 'status_code', 'service'],
  registers: [register],
});

// HTTP Request Duration Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'vaultcore_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code', 'service'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// HTTP Errors Counter
const httpErrorsTotal = new client.Counter({
  name: 'vaultcore_http_errors_total',
  help: 'Total number of HTTP error responses returned by API Gateway',
  labelNames: ['method', 'path', 'status_code', 'service'],
  registers: [register],
});

// Active Requests Gauge
const httpActiveRequests = new client.Gauge({
  name: 'vaultcore_http_active_requests',
  help: 'Number of active HTTP requests currently being processed by API Gateway',
  labelNames: ['service'],
  registers: [register],
});

// Rate Limit Allowed Counter
const rateLimitAllowedTotal = new client.Counter({
  name: 'vaultcore_rate_limit_allowed_total',
  help: 'Total number of requests allowed by distributed rate limiter',
  labelNames: ['tier'],
  registers: [register],
});

// Rate Limit Blocked Counter
const rateLimitBlockedTotal = new client.Counter({
  name: 'vaultcore_rate_limit_blocked_total',
  help: 'Total number of requests blocked with 429 by distributed rate limiter',
  labelNames: ['tier'],
  registers: [register],
});

// Circuit Breaker State Gauge (0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN)
const circuitBreakerState = new client.Gauge({
  name: 'vaultcore_circuit_breaker_state',
  help: 'Current state of circuit breaker (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
  labelNames: ['service'],
  registers: [register],
});

// Circuit Breaker Fail-Fast Counter
const circuitBreakerFailFastTotal = new client.Counter({
  name: 'vaultcore_circuit_breaker_fail_fast_total',
  help: 'Total number of fast-failed requests blocked by OPEN circuit breaker',
  labelNames: ['service'],
  registers: [register],
});

// Circuit Breaker Failures Counter
const circuitBreakerFailuresTotal = new client.Counter({
  name: 'vaultcore_circuit_breaker_failures_total',
  help: 'Total number of downstream failures recorded by circuit breaker',
  labelNames: ['service'],
  registers: [register],
});

// Circuit Breaker State Transitions Counter
const circuitBreakerTransitionsTotal = new client.Counter({
  name: 'vaultcore_circuit_breaker_transitions_total',
  help: 'Total number of circuit breaker state transitions',
  labelNames: ['service', 'from_state', 'to_state'],
  registers: [register],
});

// Circuit Breaker Recoveries Counter
const circuitBreakerRecoveriesTotal = new client.Counter({
  name: 'vaultcore_circuit_breaker_recoveries_total',
  help: 'Total number of successful circuit breaker recoveries',
  labelNames: ['service'],
  registers: [register],
});

// Helper to determine service name from path
export const resolveServiceName = (path) => {
  if (path.startsWith('/api/v1/auth') || path.startsWith('/auth')) return 'auth-service';
  if (path.startsWith('/api/v1/accounts') || path.startsWith('/accounts')) return 'account-service';
  if (path.startsWith('/api/v1/payments') || path.startsWith('/api/v1/outbox') || path.startsWith('/payments')) return 'payment-service';
  if (path.startsWith('/api/v1/ledger') || path.startsWith('/ledger')) return 'ledger-service';
  if (path.startsWith('/api/v1/notifications') || path.startsWith('/notifications')) return 'notification-service';
  if (path.startsWith('/health')) return 'gateway-health';
  if (path.startsWith('/metrics')) return 'gateway-metrics';
  if (path.startsWith('/docs')) return 'gateway-docs';
  return 'gateway-internal';
};

// Clean route path for Prometheus label cardinality
export const normalizePath = (path) => {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d{10,16}/g, '/:accountNumber')
    .split('?')[0];
};

export const metricsMiddleware = (req, res, next) => {
  if (req.path === '/metrics') {
    return next();
  }

  const startTime = process.hrtime();
  const service = resolveServiceName(req.path);
  const normalizedPath = normalizePath(req.path);

  httpActiveRequests.inc({ service });

  res.on('finish', () => {
    httpActiveRequests.dec({ service });

    const diff = process.hrtime(startTime);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    const statusCode = res.statusCode ? res.statusCode.toString() : '500';

    const labels = {
      method: req.method,
      path: normalizedPath,
      status_code: statusCode,
      service,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationInSeconds);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
  });

  next();
};

export const syncCircuitBreakerMetrics = () => {
  try {
    const breakers = circuitBreakerRegistry.getAll();
    for (const breaker of breakers) {
      const status = breaker.getStatus();
      const stateValue =
        status.state === CIRCUIT_STATES.CLOSED
          ? 0
          : status.state === CIRCUIT_STATES.HALF_OPEN
          ? 1
          : 2;

      circuitBreakerState.set({ service: breaker.name }, stateValue);
    }
  } catch {
    // Ignore sync errors
  }
};

export const metricsHandler = async (req, res) => {
  try {
    syncCircuitBreakerMetrics();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
};

export {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpErrorsTotal,
  httpActiveRequests,
  rateLimitAllowedTotal,
  rateLimitBlockedTotal,
  circuitBreakerState,
  circuitBreakerFailFastTotal,
  circuitBreakerFailuresTotal,
  circuitBreakerTransitionsTotal,
  circuitBreakerRecoveriesTotal,
};
