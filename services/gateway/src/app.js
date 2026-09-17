import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { createLogger, errorHandler, traceMiddleware, ApiResponse, circuitBreakerRegistry } from '@vaultcore/shared';
import { config } from './config/index.js';
import { responseTimeMiddleware } from './middleware/responseTime.js';
import { gatewayAuthMiddleware } from './middleware/gatewayAuth.js';
import { metricsMiddleware, metricsHandler, resolveServiceName } from './middleware/metrics.js';
import { createMicroserviceProxy } from './middleware/proxyFactory.js';
import { authRateLimiter, paymentRateLimiter, generalRateLimiter } from './middleware/rateLimiter.js';
import { HealthChecker } from './utils/healthChecker.js';
import { buildAggregatedSwaggerSpec } from './utils/swaggerAggregator.js';

const logger = createLogger('api-gateway');
const app = express();

// Enable trust proxy for Kubernetes / NGINX Ingress deployment
app.set('trust proxy', true);

// 1. Security & Performance Middlewares
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI assets
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server, curl)
      if (!origin) return callback(null, true);
      // Allow localhost on any port (e.g. Vite dev server 5173), 127.0.0.1, or cluster domains
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.vaultcore.local')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-ID', 'x-trace-id', 'X-Requested-With'],
    exposedHeaders: ['X-Trace-ID', 'X-Response-Time', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Response Time, Request Correlation & Observability
app.use(responseTimeMiddleware);
app.use(traceMiddleware);
app.use(metricsMiddleware);

// Structured Gateway Request Logger
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const responseTimeMs = req.responseTimeMs || Date.now() - startTime;
    const downstreamService = resolveServiceName(req.path);
    const userId = req.user ? (req.user.userId || req.user.id || req.user.sub) : undefined;

    logger.info(`${req.method} ${req.originalUrl || req.path} ${res.statusCode} ${responseTimeMs}ms`, {
      traceId: req.traceId,
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      responseTimeMs,
      latency: `${responseTimeMs}ms`,
      downstreamService,
      userId,
      ip: req.ip,
    });
  });
  next();
});

// 3. Prometheus Metrics Exposition
app.get(['/metrics', '/api/v1/metrics'], metricsHandler);

// 4. Unified Swagger API Documentation
const unifiedSwaggerSpec = buildAggregatedSwaggerSpec();
app.use(['/docs', '/api/v1/docs'], swaggerUi.serve, swaggerUi.setup(unifiedSwaggerSpec));

// 5. Gateway Health & Readiness Probes
app.get(['/health', '/api/v1/health'], (req, res) => {
  return ApiResponse.success(res, 'VaultCore API Gateway is healthy', HealthChecker.getGatewayOverview());
});

app.get(['/health/live', '/api/v1/health/live'], (req, res) => {
  return ApiResponse.success(res, 'Gateway is alive', HealthChecker.getLiveness());
});

app.get(['/health/ready', '/api/v1/health/ready'], async (req, res) => {
  const readiness = await HealthChecker.getReadiness();
  return ApiResponse.success(
    res,
    readiness.status === 'READY' ? 'All dependencies are healthy' : 'Platform dependencies status',
    readiness
  );
});

// 6. Admin Circuit Breaker Observability Endpoint
app.get(['/admin/circuit-breakers', '/api/v1/admin/circuit-breakers'], (req, res) => {
  return ApiResponse.success(res, 'Circuit breakers status retrieved successfully', circuitBreakerRegistry.getAllStatus());
});

// 6.5. Real-Time Server-Sent Events (SSE) Stream & Event Bus
export const bankingEventBus = new (await import('node:events')).EventEmitter();
bankingEventBus.setMaxListeners(100);

const sseClients = new Set();
const recentEventBuffer = []; // Max 100 recent events for Last-Event-ID resume
let eventSequence = 1000;

export const broadcastSSEEvent = (eventData) => {
  if (!eventData) return;
  const eventId = eventData.eventId || eventData.id || `evt-${++eventSequence}-${Date.now()}`;
  const enrichedEvent = { ...eventData, eventId, id: eventId };

  // Store in ring buffer
  recentEventBuffer.push({ id: eventId, event: enrichedEvent });
  if (recentEventBuffer.length > 100) {
    recentEventBuffer.shift();
  }

  const payload = JSON.stringify(enrichedEvent);
  const sseMessage = `id: ${eventId}\nevent: message\ndata: ${payload}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(sseMessage);
    } catch {
      sseClients.delete(client);
    }
  }
};

// Listen to Banking Event Bus
bankingEventBus.on('banking.event', (eventData) => {
  broadcastSSEEvent(eventData);
});

app.get(['/api/v1/events/stream', '/events/stream'], (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  const traceId = `trace-${Date.now()}`;
  res.write(`data: ${JSON.stringify({ type: 'connected', traceId, timestamp: new Date().toISOString() })}\n\n`);

  // Resume stream from Last-Event-ID if provided
  const lastEventId = req.headers['last-event-id'] || req.query.lastEventId;
  if (lastEventId) {
    const lastIdx = recentEventBuffer.findIndex(
      (e) => e.id === lastEventId || e.event.eventId === lastEventId || e.event.id === lastEventId
    );
    if (lastIdx !== -1 && lastIdx < recentEventBuffer.length - 1) {
      for (let i = lastIdx + 1; i < recentEventBuffer.length; i++) {
        const missed = recentEventBuffer[i];
        res.write(`id: ${missed.id}\nevent: message\ndata: ${JSON.stringify(missed.event)}\n\n`);
      }
    }
  }

  sseClients.add(res);

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

app.post(['/api/v1/events/broadcast', '/events/broadcast'], (req, res) => {
  broadcastSSEEvent(req.body);
  return ApiResponse.success(res, 'Event broadcasted to active SSE clients', {
    activeSubscribers: sseClients.size,
    event: req.body,
  });
});

// 7. Gateway Authentication Middleware (Validates JWT on protected endpoints)
app.use(gatewayAuthMiddleware);

// 7. Microservice Reverse Proxies with Distributed Rate Limiting, service-specific timeouts, and safe retry policy
app.use(
  '/api/v1/auth',
  authRateLimiter,
  createMicroserviceProxy(config.services.auth, 'Auth Service', {
    pathRewrite: { '^/api/v1/auth': '' },
    timeoutKey: 'auth',
  })
);
app.use(
  '/auth',
  authRateLimiter,
  createMicroserviceProxy(config.services.auth, 'Auth Service', {
    pathRewrite: { '^/auth': '' },
    timeoutKey: 'auth',
  })
);

app.use(
  '/api/v1/customers',
  generalRateLimiter,
  createMicroserviceProxy(config.services.account, 'Account Service (Customers)', {
    pathRewrite: (path) => (path.startsWith('/customers') ? path : `/customers${path.startsWith('/') ? '' : '/'}${path}`),
    timeoutKey: 'account',
  })
);
app.use(
  '/customers',
  generalRateLimiter,
  createMicroserviceProxy(config.services.account, 'Account Service (Customers)', {
    pathRewrite: (path) => (path.startsWith('/customers') ? path : `/customers${path.startsWith('/') ? '' : '/'}${path}`),
    timeoutKey: 'account',
  })
);

app.use(
  '/api/v1/accounts',
  generalRateLimiter,
  createMicroserviceProxy(config.services.account, 'Account Service', {
    pathRewrite: { '^/api/v1/accounts': '/accounts' },
    timeoutKey: 'account',
  })
);
app.use(
  '/accounts',
  generalRateLimiter,
  createMicroserviceProxy(config.services.account, 'Account Service', {
    timeoutKey: 'account',
  })
);

app.use(
  '/api/v1/payments',
  paymentRateLimiter,
  createMicroserviceProxy(config.services.payment, 'Payment Service', {
    pathRewrite: { '^/api/v1/payments': '' },
    timeoutKey: 'payment',
  })
);
app.use(
  '/payments',
  paymentRateLimiter,
  createMicroserviceProxy(config.services.payment, 'Payment Service', {
    pathRewrite: { '^/payments': '' },
    timeoutKey: 'payment',
  })
);

app.use(
  '/api/v1/outbox',
  paymentRateLimiter,
  createMicroserviceProxy(config.services.payment, 'Payment Service (Outbox)', {
    pathRewrite: (path) => (path.startsWith('/outbox') ? path : `/outbox${path.startsWith('/') ? '' : '/'}${path}`),
    timeoutKey: 'payment',
  })
);
app.use(
  '/outbox',
  paymentRateLimiter,
  createMicroserviceProxy(config.services.payment, 'Payment Service (Outbox)', {
    pathRewrite: (path) => (path.startsWith('/outbox') ? path : `/outbox${path.startsWith('/') ? '' : '/'}${path}`),
    timeoutKey: 'payment',
  })
);

app.use(
  '/api/v1/ledger',
  generalRateLimiter,
  createMicroserviceProxy(config.services.ledger, 'Ledger Service', {
    pathRewrite: { '^/api/v1/ledger': '' },
    timeoutKey: 'ledger',
  })
);
app.use(
  '/ledger',
  generalRateLimiter,
  createMicroserviceProxy(config.services.ledger, 'Ledger Service', {
    pathRewrite: { '^/ledger': '' },
    timeoutKey: 'ledger',
  })
);

app.use(
  '/api/v1/notifications',
  generalRateLimiter,
  createMicroserviceProxy(config.services.notification, 'Notification Service', {
    pathRewrite: { '^/api/v1/notifications': '' },
    timeoutKey: 'notification',
  })
);
app.use(
  '/notifications',
  generalRateLimiter,
  createMicroserviceProxy(config.services.notification, 'Notification Service', {
    pathRewrite: { '^/notifications': '' },
    timeoutKey: 'notification',
  })
);

// 8. Centralized Gateway Error Handler
app.use(errorHandler(logger));

export { app, logger };
