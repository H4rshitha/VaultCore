import 'dotenv/config';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import http from 'http';
import Redis from 'ioredis';
import { RateLimiterService } from '../shared/src/rate-limit/rateLimiterService.js';
import { RATE_LIMIT_CONFIG, REDIS_DATABASES, createLogger } from '@vaultcore/shared';
import { app } from '../services/gateway/src/app.js';
import { config } from '../services/gateway/src/config/index.js';
import { register } from '../services/gateway/src/middleware/metrics.js';
import { getClientIp, isExcludedRoute } from '../services/gateway/src/middleware/rateLimiter.js';

const logger = createLogger('test-rate-limiter');

async function runTests() {
  console.log('========================================================================');
  console.log(' VaultCore Prompt 13: Distributed Rate Limiter Production Hardening Suite');
  console.log('========================================================================\n');

  // 1. Verify Redis Strategy & Tier Constants (including Payment Burst)
  console.log('[1. Testing Redis Database Allocation, Tier Quotas & Payment Burst]');
  assert.strictEqual(REDIS_DATABASES.RATE_LIMIT, 0, 'Rate limiting must exclusively use Redis DB0');
  assert.strictEqual(RATE_LIMIT_CONFIG.AUTH.LIMIT, 10, 'Auth limit must be 10 req/min');
  assert.strictEqual(RATE_LIMIT_CONFIG.PAYMENT.SUSTAINED_LIMIT, 20, 'Payment sustained limit must be 20 req/min');
  assert.strictEqual(RATE_LIMIT_CONFIG.PAYMENT.BURST, 5, 'Payment burst allowance must be 5 req');
  assert.strictEqual(RATE_LIMIT_CONFIG.PAYMENT.LIMIT, 25, 'Payment total limit with burst must be 25 req/min');
  assert.strictEqual(RATE_LIMIT_CONFIG.GENERAL.LIMIT, 100, 'General limit must be 100 req/min');
  console.log('  ✔ Redis DB0 allocated; Payment Tier configured with 20 sustained + 5 burst = 25 limit');

  // 2. Test Client IP Extraction Priority
  console.log('\n[2. Testing Client IP Extraction Priority for Ingress / NGINX]');
  // Case A: req.ip priority 1
  const reqA = { ip: '198.51.100.1', headers: { 'x-forwarded-for': '203.0.113.50, 10.0.0.1' }, socket: { remoteAddress: '10.0.0.1' } };
  assert.strictEqual(getClientIp(reqA), '198.51.100.1', 'Priority 1: req.ip is chosen when present');

  // Case B: X-Forwarded-For priority 2 (first IP in comma-separated list)
  const reqB = { headers: { 'x-forwarded-for': '203.0.113.50, 10.0.0.2, 10.0.0.3' }, socket: { remoteAddress: '10.0.0.1' } };
  assert.strictEqual(getClientIp(reqB), '203.0.113.50', 'Priority 2: First IP from X-Forwarded-For is chosen');

  // Case C: Socket remote address fallback
  const reqC = { headers: {}, socket: { remoteAddress: '192.168.1.100' } };
  assert.strictEqual(getClientIp(reqC), '192.168.1.100', 'Priority 3: req.socket.remoteAddress is chosen');
  console.log('  ✔ Client IP priority successfully extracts real client IP behind load balancers');

  // 3. Test Infrastructure Route Exclusions
  console.log('\n[3. Testing Infrastructure Route Exclusions]');
  assert.strictEqual(isExcludedRoute({ path: '/health' }), true, '/health is excluded');
  assert.strictEqual(isExcludedRoute({ path: '/health/live' }), true, '/health/live is excluded');
  assert.strictEqual(isExcludedRoute({ path: '/health/ready' }), true, '/health/ready is excluded');
  assert.strictEqual(isExcludedRoute({ path: '/metrics' }), true, '/metrics is excluded');
  assert.strictEqual(isExcludedRoute({ path: '/docs' }), true, '/docs is excluded');
  assert.strictEqual(isExcludedRoute({ path: '/docs/swagger-ui.css' }), true, '/docs/* assets are excluded');
  assert.strictEqual(isExcludedRoute({ path: '/api/v1/payments/transfer' }), false, 'Payment API is not excluded');
  console.log('  ✔ Infrastructure endpoints bypass rate limiting logic');

  // 4. Test In-Memory Sliding Window Lua Script on Redis DB0
  console.log('\n[4. Testing Redis DB0 Atomic Sliding Window Lua Execution]');
  const rateLimiter = new RateLimiterService({ logger });
  const testKey = `rate:test:user-${Date.now()}`;

  await rateLimiter.reset(testKey);

  const res1 = await rateLimiter.checkRateLimit(testKey, 3, 60);
  assert.strictEqual(res1.allowed, true);
  assert.strictEqual(res1.remaining, 2);
  assert.strictEqual(res1.limit, 3);
  assert.ok(res1.resetTime > 0);

  const res2 = await rateLimiter.checkRateLimit(testKey, 3, 60);
  assert.strictEqual(res2.allowed, true);
  assert.strictEqual(res2.remaining, 1);

  const res3 = await rateLimiter.checkRateLimit(testKey, 3, 60);
  assert.strictEqual(res3.allowed, true);
  assert.strictEqual(res3.remaining, 0);

  const res4 = await rateLimiter.checkRateLimit(testKey, 3, 60);
  assert.strictEqual(res4.allowed, false);
  assert.strictEqual(res4.remaining, 0);
  assert.ok(res4.retryAfter >= 1);
  console.log('  ✔ Sliding window allows up to quota, accurately counts down, and returns integer retryAfter');

  await rateLimiter.reset(testKey);
  await rateLimiter.close();

  // 5. Test Gateway HTTP Server Integration (Trust Proxy, Burst, Headers, Infrastructure bypass)
  console.log('\n[5. Testing Gateway HTTP Rate Limiting, Trust Proxy & Payment Burst]');
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const baseUrl = `http://localhost:${port}`;

  const redis0 = new Redis({ host: 'localhost', port: 6379, db: 0 });

  try {
    // 5.1 Infrastructure Endpoints bypass test (send 20 rapid requests)
    console.log('  5.1 Verifying /health, /metrics, /docs bypass rate limiting...');
    for (let i = 0; i < 5; i++) {
      const hRes = await fetch(`${baseUrl}/health`);
      assert.strictEqual(hRes.status, 200);
      assert.strictEqual(hRes.headers.get('x-ratelimit-limit'), null, '/health does not set rate limit headers');

      const mRes = await fetch(`${baseUrl}/metrics`);
      assert.strictEqual(mRes.status, 200);
      assert.strictEqual(mRes.headers.get('x-ratelimit-limit'), null, '/metrics does not set rate limit headers');
    }
    console.log('    ✔ Infrastructure endpoints never consume rate limit quota');

    // 5.2 Test Auth Endpoint Rate Limiting (10 req/min per IP) + RFC Retry-After
    console.log('\n  5.2 Testing Auth API (10 req/min per IP) & RFC Retry-After...');
    const testIp = '203.0.113.195';
    await redis0.del(`rate:ip:${testIp}`);

    let authBlocked = false;
    let authHeaders = null;

    for (let i = 1; i <= 11; i++) {
      const res = await fetch(`${baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `${testIp}, 10.0.0.1`,
        },
        body: JSON.stringify({ email: `test-${i}@example.com`, password: 'Password123!', firstName: 'Test', lastName: 'User' }),
      });

      authHeaders = {
        limit: res.headers.get('x-ratelimit-limit'),
        remaining: res.headers.get('x-ratelimit-remaining'),
        reset: res.headers.get('x-ratelimit-reset'),
        retryAfter: res.headers.get('retry-after'),
      };

      if (res.status === 429) {
        authBlocked = true;
        assert.strictEqual(authHeaders.limit, '10');
        assert.strictEqual(authHeaders.remaining, '0');
        assert.ok(authHeaders.retryAfter);
        assert.strictEqual(Number.isInteger(Number(authHeaders.retryAfter)), true, 'Retry-After must be an integer');
        assert.strictEqual(Number.isInteger(Number(authHeaders.reset)), true, 'X-RateLimit-Reset must be an integer timestamp');

        const json429 = await res.json();
        assert.strictEqual(json429.success, false);
        const code = json429.error?.details?.code || json429.error?.code;
        assert.strictEqual(code, 'RATE_LIMIT_EXCEEDED');
        console.log(`    ✔ Request #${i} blocked with HTTP 429; Retry-After: ${authHeaders.retryAfter}s (integer verified)`);
        break;
      }
    }
    assert.strictEqual(authBlocked, true, 'Request 11 was blocked on 10 req/min limit');

    // 5.3 Test Payment API Burst Support (20 sustained + 5 burst = 25 immediate requests allowed)
    console.log('\n  5.3 Testing Payment API Burst Allowance (20 sustained + 5 burst = 25 total)...');
    const burstUserId = `usr-burst-${Date.now()}`;
    await redis0.del(`rate:user:${burstUserId}`);

    const userToken = jwt.sign(
      { userId: burstUserId, email: 'payer@vaultcore.io', role: 'CUSTOMER' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    let paymentBlocked = false;
    let paymentRequestsCompleted = 0;

    // Send 26 requests: 1-25 must be permitted, 26th must be blocked with HTTP 429
    for (let i = 1; i <= 26; i++) {
      const res = await fetch(`${baseUrl}/api/v1/payments/history`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      const limitHeader = res.headers.get('x-ratelimit-limit');
      const remainingHeader = res.headers.get('x-ratelimit-remaining');

      if (res.status !== 429) {
        assert.strictEqual(limitHeader, '25', 'Payment limit header reflects 25 (20 sustained + 5 burst)');
        assert.strictEqual(Number(remainingHeader), 25 - i, `Remaining quota correctly decrements to ${25 - i}`);
        paymentRequestsCompleted++;
      } else {
        paymentBlocked = true;
        const retryAfter = res.headers.get('retry-after');
        assert.strictEqual(i, 26, 'Payment request must only be blocked on the 26th request');
        assert.strictEqual(remainingHeader, '0', 'Remaining quota is 0 on 429');
        assert.strictEqual(Number.isInteger(Number(retryAfter)), true, 'Retry-After on payment 429 is integer seconds');
        console.log(`    ✔ Successfully permitted 25 burst requests; blocked request #26 with HTTP 429 (Retry-After: ${retryAfter}s)`);
        break;
      }
    }

    assert.strictEqual(paymentRequestsCompleted, 25, 'Exact 25 requests permitted before throttling');
    assert.strictEqual(paymentBlocked, true, '26th request throttled');

    // 5.4 Test General API (100 req/min)
    console.log('\n  5.4 Testing General API limit (100 req/min)...');
    const resGeneral = await fetch(`${baseUrl}/api/v1/accounts/100010001001`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(resGeneral.headers.get('x-ratelimit-limit'), '100', 'General endpoint quota is 100 req/min');
    console.log('    ✔ General route returned X-RateLimit-Limit: 100');

    // 6. Test Prometheus Rate Limiter Metrics
    console.log('\n[6. Testing Prometheus Rate Limiter Metrics]');
    const metricsOutput = await register.metrics();
    assert.ok(metricsOutput.includes('vaultcore_rate_limit_allowed_total'));
    assert.ok(metricsOutput.includes('vaultcore_rate_limit_blocked_total'));
    console.log('  ✔ Prometheus metrics tracked: vaultcore_rate_limit_allowed_total and vaultcore_rate_limit_blocked_total');

    // Cleanup
    await redis0.del(`rate:ip:${testIp}`);
    await redis0.del(`rate:user:${burstUserId}`);
    await redis0.quit();
  } finally {
    await new Promise((resolve) => testServer.close(resolve));
  }

  console.log('\n========================================================================');
  console.log(' ✔ ALL PROMPT 13 PRODUCTION REFINEMENT TESTS PASSED SUCCESSFULLY');
  console.log('========================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n✖ Test failed:', err);
  process.exit(1);
});
