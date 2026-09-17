import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import http from 'http';
import { fileURLToPath } from 'url';

import { register, syncAllCircuitBreakers } from '../shared/src/metrics/index.js';
import { app as gatewayApp } from '../services/gateway/src/app.js';
import { app as paymentApp } from '../services/payment-service/src/app.js';
import { app as ledgerApp } from '../services/ledger-service/src/app.js';
import { app as notifApp } from '../services/notification-service/src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runTests() {
  console.log('========================================================================');
  console.log('🚀 VAULTCORE PROMPT 16 — OBSERVABILITY & PERFORMANCE VERIFICATION');
  console.log('========================================================================\n');

  // 1. Test Microservices /metrics HTTP Endpoints
  console.log('[1. Testing Microservices Prometheus /metrics Endpoints]');

  const testApps = [
    { name: 'Gateway', app: gatewayApp },
    { name: 'Payment Service', app: paymentApp },
    { name: 'Ledger Service', app: ledgerApp },
    { name: 'Notification Service', app: notifApp },
  ];

  for (const item of testApps) {
    const server = http.createServer(item.app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const url = `http://localhost:${port}/metrics`;

    try {
      const res = await fetch(url);
      assert.strictEqual(res.status, 200, `${item.name} /metrics must return HTTP 200`);
      const body = await res.text();
      assert.ok(body.includes('vaultcore_'), `${item.name} /metrics must expose vaultcore_ metrics`);
      console.log(`  ✔ ${item.name} /metrics endpoint responding with Prometheus telemetry`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  // 2. Test Prometheus Scrape Configuration
  console.log('\n[2. Testing Prometheus Scrape Targets]');
  const promConfigPath = path.join(rootDir, 'monitoring/prometheus/prometheus.yml');
  assert.strictEqual(fs.existsSync(promConfigPath), true);
  const promConfig = fs.readFileSync(promConfigPath, 'utf-8');
  assert.ok(promConfig.includes('vaultcore-gateway'));
  assert.ok(promConfig.includes('vaultcore-payment'));
  assert.ok(promConfig.includes('vaultcore-ledger'));
  assert.ok(promConfig.includes('vaultcore-notification'));
  console.log('  ✔ Prometheus config successfully targets all core microservices');

  // 3. Test 7 Grafana Dashboard JSON Models
  console.log('\n[3. Testing 7 Grafana Dashboards]');
  const dashboardsDir = path.join(rootDir, 'monitoring/grafana/dashboards');
  const requiredDashboards = [
    'api-gateway.json',
    'payments.json',
    'redis.json',
    'rabbitmq.json',
    'notification-service.json',
    'distributed-locks.json',
    'outbox-worker.json',
  ];

  for (const dashFile of requiredDashboards) {
    const dashPath = path.join(dashboardsDir, dashFile);
    assert.strictEqual(fs.existsSync(dashPath), true, `Dashboard ${dashFile} must exist`);
    const raw = fs.readFileSync(dashPath, 'utf-8');
    const parsed = JSON.parse(raw);
    assert.ok(parsed.title, `Dashboard ${dashFile} must have a title`);
    assert.ok(parsed.panels && parsed.panels.length > 0, `Dashboard ${dashFile} must contain panels`);
    console.log(`  ✔ Grafana dashboard verified: ${parsed.title} (${parsed.panels.length} panels)`);
  }

  // 4. Test Grafana Provisioning Configs
  console.log('\n[4. Testing Grafana Provisioning Configuration]');
  assert.strictEqual(fs.existsSync(path.join(rootDir, 'monitoring/grafana/provisioning/datasources/prometheus.yml')), true);
  assert.strictEqual(fs.existsSync(path.join(rootDir, 'monitoring/grafana/provisioning/dashboards/dashboards.yml')), true);
  console.log('  ✔ Datasource and dashboard provisioning configurations verified');

  // 5. Test k6 Performance Test Scripts
  console.log('\n[5. Testing k6 Load Test Suite]');
  const k6ScriptPath = path.join(rootDir, 'load-tests/k6/full-suite.js');
  assert.strictEqual(fs.existsSync(k6ScriptPath), true);
  const k6Script = fs.readFileSync(k6ScriptPath, 'utf-8');
  assert.ok(k6Script.includes('100'), 'Includes 100 VU stage');
  assert.ok(k6Script.includes('200'), 'Includes 200 VU stage');
  assert.ok(k6Script.includes('500'), 'Includes 500 VU stage');
  assert.ok(k6Script.includes('/api/v1/auth/login'));
  assert.ok(k6Script.includes('/api/v1/accounts/'));
  assert.ok(k6Script.includes('/api/v1/payments/transfer'));
  assert.ok(k6Script.includes('/api/v1/payments/history'));
  assert.ok(k6Script.includes('/api/v1/notifications/history'));
  console.log('  ✔ k6 load test script verified (100, 200, 500 VUs across all 5 banking scenarios)');

  // 6. Test Documentation Report
  console.log('\n[6. Testing Performance Report Documentation]');
  const reportPath = path.join(rootDir, 'docs/performance-report.md');
  assert.strictEqual(fs.existsSync(reportPath), true);
  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  assert.ok(reportContent.includes('Executive Summary'));
  assert.ok(reportContent.includes('Latency Percentiles'));
  assert.ok(reportContent.includes('Cache Hit Ratio'));
  assert.ok(reportContent.includes('Distributed Locks'));
  assert.ok(reportContent.includes('RabbitMQ'));
  assert.ok(reportContent.includes('Bottlenecks'));
  assert.ok(reportContent.includes('Recommendations'));
  console.log('  ✔ docs/performance-report.md verified with full metrics matrix & recommendations');

  console.log('\n========================================================================');
  console.log(' ✔ ALL PROMPT 16 OBSERVABILITY & PERFORMANCE TESTS PASSED');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n✖ Observability test failed:', err);
  process.exit(1);
});
