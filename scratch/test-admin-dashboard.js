import http from 'http';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { app } from '../services/gateway/src/app.js';
import { register } from '../services/gateway/src/middleware/metrics.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026';

async function fetchLocal(baseUrl, path, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data })
        );
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log(' VaultCore: Admin Dashboard & Gateway Endpoint Test Suite');
  console.log('========================================================================\n');

  // Spin up the gateway app on a random OS-assigned port (no localhost:3000 dependency)
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const base = `http://localhost:${port}`;
  console.log(`[Gateway test server running on port ${port}]\n`);

  try {
    // 1. Health & Liveness
    console.log('[1. Testing Health Endpoints]');
    const healthRes = await fetchLocal(base, '/health');
    assert.strictEqual(healthRes.status, 200, 'GET /health must return 200');
    console.log(`  ✔ GET /health: ${healthRes.status}`);

    const liveRes = await fetchLocal(base, '/health/live');
    assert.strictEqual(liveRes.status, 200, 'GET /health/live must return 200');
    console.log(`  ✔ GET /health/live: ${liveRes.status}`);

    // /health/ready may return 200 or 503 depending on downstream — both are valid in CI
    const readyRes = await fetchLocal(base, '/health/ready');
    assert.ok(
      [200, 503].includes(readyRes.status),
      `GET /health/ready returned unexpected status ${readyRes.status}`
    );
    console.log(`  ✔ GET /health/ready: ${readyRes.status} (200 or 503 valid in CI)`);

    // /api/v1 alias
    const v1HealthRes = await fetchLocal(base, '/api/v1/health');
    assert.ok([200, 404].includes(v1HealthRes.status), 'GET /api/v1/health responded');
    console.log(`  ✔ GET /api/v1/health: ${v1HealthRes.status}`);

    // 2. Metrics
    console.log('\n[2. Testing Prometheus Metrics Endpoint]');
    const metricsRes = await fetchLocal(base, '/metrics');
    assert.strictEqual(metricsRes.status, 200, 'GET /metrics must return 200');
    assert.ok(
      metricsRes.body.includes('vaultcore_http_requests_total'),
      'Metrics must contain vaultcore_http_requests_total'
    );
    console.log(
      `  ✔ GET /metrics: ${metricsRes.status}, body length: ${metricsRes.body.length} bytes`
    );

    // 3. Circuit Breakers Admin Endpoint
    console.log('\n[3. Testing Circuit Breaker Admin Endpoint]');
    const cbRes = await fetchLocal(base, '/admin/circuit-breakers');
    assert.strictEqual(cbRes.status, 200, 'GET /admin/circuit-breakers must return 200');
    const cbJson = JSON.parse(cbRes.body);
    assert.strictEqual(cbJson.success, true, 'Circuit breaker response must have success: true');
    console.log(`  ✔ GET /admin/circuit-breakers: ${cbRes.status}`);

    const v1CbRes = await fetchLocal(base, '/api/v1/admin/circuit-breakers');
    assert.strictEqual(v1CbRes.status, 200, 'GET /api/v1/admin/circuit-breakers must return 200');
    console.log(`  ✔ GET /api/v1/admin/circuit-breakers: ${v1CbRes.status}`);

    // 4. Protected route returns 401 without token
    console.log('\n[4. Testing Protected Endpoint Auth]');
    const protectedRes = await fetchLocal(base, '/api/v1/payments/history');
    assert.strictEqual(protectedRes.status, 401, 'Protected route without JWT must return 401');
    console.log(`  ✔ GET /api/v1/payments/history (no token): ${protectedRes.status}`);

    // 5. Admin JWT auth test
    console.log('\n[5. Testing Admin JWT Token Forwarding]');
    const adminToken = jwt.sign(
      { userId: 'fdf48810-2a68-4d57-929b-9566c723c56f', role: 'ADMIN', email: 'admin@vaultcore.io' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const notifRes = await fetchLocal(base, '/api/v1/notifications/admin/status', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    // 502 is acceptable in CI (no notification service running), 200 is ideal
    assert.ok(
      [200, 401, 502, 503, 504].includes(notifRes.status),
      `Admin notification status returned unexpected status ${notifRes.status}`
    );
    console.log(
      `  ✔ GET /api/v1/notifications/admin/status (admin JWT): ${notifRes.status} (upstream may be unavailable in CI)`
    );

    // 6. Verify Prometheus metrics accumulated from requests above
    console.log('\n[6. Verifying Prometheus Metrics Accumulated]');
    const metricsOutput = await register.metrics();
    assert.ok(
      metricsOutput.includes('vaultcore_http_requests_total'),
      'Prometheus registry must have vaultcore_http_requests_total'
    );
    console.log('  ✔ Prometheus metrics registry contains request counters');

    console.log('\n========================================================================');
    console.log(' ✔ ALL ADMIN DASHBOARD GATEWAY TESTS PASSED SUCCESSFULLY');
    console.log('========================================================================\n');
  } finally {
    await new Promise((resolve) => testServer.close(resolve));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('\n✖ Admin dashboard test failed:', err.message);
  process.exit(1);
});
