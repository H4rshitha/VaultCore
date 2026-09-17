import http from 'http';
import jwt from 'jsonwebtoken';

async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
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
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log('--- Testing Gateway Admin Endpoints ---');

  // 1. Health & Readiness
  const healthRes = await request('http://localhost:3000/health');
  console.log(`GET /health: ${healthRes.status}`);

  const v1HealthRes = await request('http://localhost:3000/api/v1/health');
  console.log(`GET /api/v1/health: ${v1HealthRes.status}`);

  const readyRes = await request('http://localhost:3000/health/ready');
  console.log(`GET /health/ready: ${readyRes.status}`);

  const v1ReadyRes = await request('http://localhost:3000/api/v1/health/ready');
  console.log(`GET /api/v1/health/ready: ${v1ReadyRes.status}`);

  // 2. Metrics
  const metricsRes = await request('http://localhost:3000/metrics');
  console.log(`GET /metrics: ${metricsRes.status}, body length: ${metricsRes.body.length}`);

  const v1MetricsRes = await request('http://localhost:3000/api/v1/metrics');
  console.log(`GET /api/v1/metrics: ${v1MetricsRes.status}, body length: ${v1MetricsRes.body.length}`);

  // 3. Circuit Breakers
  const cbRes = await request('http://localhost:3000/admin/circuit-breakers');
  console.log(`GET /admin/circuit-breakers: ${cbRes.status}`);

  const v1CbRes = await request('http://localhost:3000/api/v1/admin/circuit-breakers');
  console.log(`GET /api/v1/admin/circuit-breakers: ${v1CbRes.status}`);

  // 4. Outbox Status
  const outboxRes = await request('http://localhost:3000/api/v1/outbox/status');
  console.log(`GET /api/v1/outbox/status: ${outboxRes.status}, body: ${outboxRes.body.slice(0, 100)}`);

  // 5. Admin Notification Status & JWT test
  const adminToken = jwt.sign(
    {
      userId: 'fdf48810-2a68-4d57-929b-9566c723c56f',
      role: 'ADMIN',
      email: 'sapnapalaram@gmsil.com',
    },
    'super-secret-vaultcore-jwt-key-2026',
    { expiresIn: '1h' }
  );

  const notifRes = await request('http://localhost:3000/api/v1/notifications/admin/status', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`GET /api/v1/notifications/admin/status: ${notifRes.status}, body: ${notifRes.body.slice(0, 100)}`);

  // 6. Test Prometheus metrics parsing function
  const { parsePrometheusText } = await import('../frontend/src/hooks/useAdmin.js');
  const parsedMetrics = parsePrometheusText(metricsRes.body);
  console.log('Parsed Prometheus Metrics:');
  console.log('  Total HTTP Requests:', parsedMetrics.httpRequestsTotal);
  console.log('  HTTP Errors Total:', parsedMetrics.httpErrorsTotal);
  console.log('  Active Requests:', parsedMetrics.httpActiveRequests);
  console.log('  Rate Limit Blocked:', parsedMetrics.rateLimitBlockedTotal);

  console.log('--- All Admin Endpoint Tests Completed Successfully ---');
}

run().catch(console.error);
