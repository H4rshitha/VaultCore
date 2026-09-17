import 'dotenv/config';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import http from 'http';
import { isPublicPath, gatewayAuthMiddleware } from '../services/gateway/src/middleware/gatewayAuth.js';
import { resolveServiceName, normalizePath, register } from '../services/gateway/src/middleware/metrics.js';
import { HealthChecker } from '../services/gateway/src/utils/healthChecker.js';
import { buildAggregatedSwaggerSpec } from '../services/gateway/src/utils/swaggerAggregator.js';
import { app } from '../services/gateway/src/app.js';
import { config } from '../services/gateway/src/config/index.js';

async function runTests() {
  console.log('========================================================================');
  console.log(' VaultCore Prompt 12: API Gateway Refinement Test Suite');
  console.log('========================================================================\n');

  // 1. Test Service-Specific Timeouts Configuration
  console.log('[1. Testing Service-Specific Proxy Timeouts]');
  assert.strictEqual(config.timeouts.auth, 3000, 'Auth service timeout should be 3000ms');
  assert.strictEqual(config.timeouts.account, 5000, 'Account service timeout should be 5000ms');
  assert.strictEqual(config.timeouts.payment, 8000, 'Payment service timeout should be 8000ms');
  assert.strictEqual(config.timeouts.ledger, 8000, 'Ledger service timeout should be 8000ms');
  assert.strictEqual(config.timeouts.notification, 5000, 'Notification service timeout should be 5000ms');
  console.log('  ✔ Service timeouts configured: Auth (3s), Account (5s), Payment (8s), Ledger (8s), Notification (5s)');

  // 2. Test Enhanced Readiness Probe
  console.log('\n[2. Testing Enhanced Readiness Probe (/health/ready)]');
  const readiness = await HealthChecker.getReadiness();
  assert.ok(['READY', 'DEGRADED'].includes(readiness.status));
  assert.ok(readiness.infrastructure.postgres);
  assert.ok(readiness.infrastructure.redis);
  assert.ok(readiness.infrastructure.rabbitmq);
  assert.ok(readiness.microservices.auth);
  assert.ok(readiness.microservices.account);
  assert.ok(readiness.microservices.payment);
  assert.ok(readiness.microservices.ledger);
  assert.ok(readiness.microservices.notification);
  console.log('  ✔ Enhanced readiness probe verifies Postgres, Redis, RabbitMQ, and all 5 microservices');

  // 3. Test HTTP Server & Response Time Header
  console.log('\n[3. Testing HTTP Server & X-Response-Time Header]');
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 3.1 GET /health returns X-Response-Time & X-Trace-ID
    const resHealth = await fetch(`${baseUrl}/health`);
    assert.strictEqual(resHealth.status, 200);
    const responseTimeHeader = resHealth.headers.get('x-response-time');
    assert.ok(responseTimeHeader, 'X-Response-Time header must be present');
    assert.ok(responseTimeHeader.endsWith('ms'), 'X-Response-Time format should end with ms');
    assert.ok(resHealth.headers.get('x-trace-id'), 'X-Trace-ID must be present');
    console.log(`  ✔ GET /health returned X-Response-Time: ${responseTimeHeader}`);

    // 3.2 GET /health/live
    const resLive = await fetch(`${baseUrl}/health/live`);
    assert.strictEqual(resLive.status, 200);
    assert.ok(resLive.headers.get('x-response-time'));
    console.log('  ✔ GET /health/live returned 200 with X-Response-Time');

    // 3.3 GET /health/ready
    const resReady = await fetch(`${baseUrl}/health/ready`);
    assert.ok([200, 503].includes(resReady.status));
    const readyJson = await resReady.json();
    assert.ok(readyJson.data.infrastructure);
    assert.ok(readyJson.data.microservices);
    assert.ok(resReady.headers.get('x-response-time'));
    console.log('  ✔ GET /health/ready returned full infrastructure and microservices health breakdown');

    // 3.4 GET /metrics
    const resMetrics = await fetch(`${baseUrl}/metrics`);
    assert.strictEqual(resMetrics.status, 200);
    const metricsText = await resMetrics.text();
    assert.ok(metricsText.includes('vaultcore_http_requests_total'));
    console.log('  ✔ GET /metrics returned Prometheus exposition data');

    // 3.5 Authentication & Context Forwarding
    const validToken = jwt.sign(
      { userId: 'usr-bob-888', email: 'bob@vaultcore.io', role: 'CUSTOMER' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const mockReq = { path: '/api/v1/accounts/123456', headers: { authorization: `Bearer ${validToken}` } };
    gatewayAuthMiddleware(mockReq, {}, () => {});
    assert.strictEqual(mockReq.headers['x-user-id'], 'usr-bob-888');
    assert.strictEqual(mockReq.headers['x-user-role'], 'CUSTOMER');
    assert.strictEqual(mockReq.headers['x-user-email'], 'bob@vaultcore.io');
    console.log('  ✔ User context headers (x-user-id, x-user-role, x-user-email) correctly set for proxy');

    // 3.6 Unauthenticated Protected Path -> 401
    const resProtected = await fetch(`${baseUrl}/api/v1/payments/history`);
    assert.strictEqual(resProtected.status, 401);
    assert.ok(resProtected.headers.get('x-response-time'));
    console.log('  ✔ Protected endpoint without JWT returns HTTP 401 Unauthorized with X-Response-Time header');
  } finally {
    testServer.close();
  }

  console.log('\n========================================================================');
  console.log(' ✔ ALL PROMPT 12 REFINEMENT TESTS PASSED SUCCESSFULLY');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n✖ Test failed:', err);
  process.exit(1);
});
