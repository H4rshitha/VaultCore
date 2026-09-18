import 'dotenv/config';
import assert from 'node:assert';
import http from 'http';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  CircuitBreakerOpenError,
  CIRCUIT_STATES,
  CIRCUIT_BREAKER_CONFIG,
  ledgerCircuitBreaker,
  rabbitmqCircuitBreaker,
  notificationCircuitBreaker,
  rateLimiterService,
  accountCache,
  lockService,
} from '@vaultcore/shared';
import { app } from '../services/gateway/src/app.js';
import { register, syncCircuitBreakerMetrics } from '../services/gateway/src/middleware/metrics.js';

async function runTests() {
  console.log('========================================================================');
  console.log('🚀 VAULTCORE PROMPT 14 — CIRCUIT BREAKER & SERVICE RESILIENCE SUITE');
  console.log('========================================================================\n');

  // 1. Configuration & Initial State Verification
  console.log('[1. Testing Circuit Breaker Configuration & Initial States]');
  assert.strictEqual(CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD, 5, 'Failure threshold must be 5');
  assert.strictEqual(CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD, 3, 'Success threshold must be 3');
  assert.strictEqual(
    CIRCUIT_BREAKER_CONFIG.OPEN_TIMEOUT_MS,
    30000,
    'Open timeout must be 30,000ms'
  );

  const testBreaker = new CircuitBreaker({
    name: 'test-resilience-service',
    failureThreshold: 5,
    successThreshold: 3,
    openTimeoutMs: 200, // short timeout for rapid test
  });

  assert.strictEqual(testBreaker.state, CIRCUIT_STATES.CLOSED, 'Initial state must be CLOSED');
  console.log(
    '  ✔ Circuit breaker initialized in CLOSED state with 5-failure threshold and 3-success recovery'
  );

  // 2. CLOSED State Execution & Consecutive Failure Tripping
  console.log('\n[2. Testing CLOSED -> OPEN State Transition on 5 Failures]');
  let executionCount = 0;

  // 2.1 Successful executions in CLOSED state
  const successResult = await testBreaker.execute(async () => {
    executionCount++;
    return { data: 'ok' };
  });
  assert.strictEqual(successResult.data, 'ok');
  assert.strictEqual(executionCount, 1);
  assert.strictEqual(testBreaker.state, CIRCUIT_STATES.CLOSED);
  assert.strictEqual(testBreaker.consecutiveFailures, 0);

  // 2.2 Trigger 4 consecutive failures -> should still remain CLOSED
  for (let i = 1; i <= 4; i++) {
    try {
      await testBreaker.execute(
        async () => {
          executionCount++;
          throw new Error(`Transient failure ${i}`);
        },
        { traceId: `trace-fail-${i}` }
      );
      assert.fail('Should have thrown error');
    } catch (err) {
      assert.strictEqual(err.message, `Transient failure ${i}`);
    }
    assert.strictEqual(testBreaker.state, CIRCUIT_STATES.CLOSED);
    assert.strictEqual(testBreaker.consecutiveFailures, i);
  }
  console.log('  ✔ 4 consecutive failures maintained CLOSED state');

  // 2.3 5th consecutive failure -> must trip circuit to OPEN
  try {
    await testBreaker.execute(
      async () => {
        executionCount++;
        throw new Error('5th fatal failure');
      },
      { traceId: 'trace-fail-5' }
    );
    assert.fail('Should have tripped circuit');
  } catch (err) {
    assert.strictEqual(err.message, '5th fatal failure');
  }

  assert.strictEqual(
    testBreaker.state,
    CIRCUIT_STATES.OPEN,
    'Circuit must trip to OPEN on 5th failure'
  );
  assert.strictEqual(testBreaker.stats.failedRequests, 5);
  console.log('  ✔ 5th consecutive failure tripped circuit to OPEN state');

  // 3. OPEN State: Immediate Fail-Fast Behavior
  console.log('\n[3. Testing OPEN State Immediate Fail-Fast]');
  const countBeforeFailFast = executionCount;

  for (let i = 1; i <= 3; i++) {
    try {
      await testBreaker.execute(
        async () => {
          executionCount++;
          return 'should-not-run';
        },
        { traceId: `trace-fast-fail-${i}` }
      );
      assert.fail('Should have failed fast with CircuitBreakerOpenError');
    } catch (err) {
      assert.strictEqual(
        err instanceof CircuitBreakerOpenError,
        true,
        'Error must be instance of CircuitBreakerOpenError'
      );
      assert.strictEqual(err.statusCode, 503, 'CircuitBreakerOpenError status code is 503');
      assert.strictEqual(err.circuitState, CIRCUIT_STATES.OPEN);
      assert.strictEqual(err.serviceName, 'test-resilience-service');
      assert.ok(err.retryAfterSec > 0, 'retryAfterSec is positive integer');
    }
  }

  assert.strictEqual(
    executionCount,
    countBeforeFailFast,
    'Downstream action MUST NOT be executed during OPEN state'
  );
  assert.strictEqual(
    testBreaker.stats.failFastCount,
    3,
    'Fail-fast counter tracked 3 blocked requests'
  );
  console.log(
    '  ✔ OPEN state failed fast immediately without invoking downstream dependency (Fail-fast count: 3)'
  );

  // 4. OPEN -> HALF_OPEN on Timeout Expiry & Re-trip on Failure
  console.log('\n[4. Testing OPEN -> HALF_OPEN Timeout & Immediate Re-trip on Probe Failure]');
  // Wait for openTimeoutMs (200ms)
  await new Promise((resolve) => setTimeout(resolve, 250));

  // In HALF_OPEN: test failure causes immediate trip back to OPEN
  try {
    await testBreaker.execute(
      async () => {
        executionCount++;
        throw new Error('Downstream still unhealthy');
      },
      { traceId: 'trace-half-open-fail' }
    );
    assert.fail('Should have thrown probe error');
  } catch (err) {
    assert.strictEqual(err.message, 'Downstream still unhealthy');
  }

  assert.strictEqual(
    testBreaker.state,
    CIRCUIT_STATES.OPEN,
    'Failure in HALF_OPEN must immediately reopen circuit'
  );
  console.log(
    '  ✔ Timeout transitioned to HALF_OPEN; probe failure immediately tripped back to OPEN'
  );

  // 5. HALF_OPEN -> CLOSED Recovery (3 Consecutive Successes)
  console.log('\n[5. Testing HALF_OPEN -> CLOSED Recovery on 3 Consecutive Successes]');
  // Wait again for open timeout to expire
  await new Promise((resolve) => setTimeout(resolve, 250));

  // Probe request 1
  const p1 = await testBreaker.execute(
    async () => {
      executionCount++;
      return 'probe-1-success';
    },
    { traceId: 'trace-probe-1' }
  );
  assert.strictEqual(p1, 'probe-1-success');
  assert.strictEqual(testBreaker.state, CIRCUIT_STATES.HALF_OPEN);
  assert.strictEqual(testBreaker.halfOpenSuccessCount, 1);

  // Probe request 2
  const p2 = await testBreaker.execute(
    async () => {
      executionCount++;
      return 'probe-2-success';
    },
    { traceId: 'trace-probe-2' }
  );
  assert.strictEqual(p2, 'probe-2-success');
  assert.strictEqual(testBreaker.state, CIRCUIT_STATES.HALF_OPEN);
  assert.strictEqual(testBreaker.halfOpenSuccessCount, 2);

  // Probe request 3 -> meets threshold of 3 -> recovers to CLOSED
  const p3 = await testBreaker.execute(
    async () => {
      executionCount++;
      return 'probe-3-success';
    },
    { traceId: 'trace-probe-3' }
  );
  assert.strictEqual(p3, 'probe-3-success');
  assert.strictEqual(
    testBreaker.state,
    CIRCUIT_STATES.CLOSED,
    'Circuit must recover to CLOSED after 3 successes'
  );
  assert.strictEqual(testBreaker.stats.recoveryCount, 1, 'Recovery count is 1');
  console.log('  ✔ 3 consecutive successful probe requests recovered circuit back to CLOSED state');

  // 6. Test Default Protected Circuit Breakers in Registry
  console.log('\n[6. Testing Protected Service Registry Singletons]');
  const allStatus = circuitBreakerRegistry.getAllStatus();

  assert.ok(allStatus['ledger-service'], 'Ledger Service circuit breaker registered');
  assert.ok(allStatus['rabbitmq-publisher'], 'RabbitMQ Publisher circuit breaker registered');
  assert.ok(allStatus['notification-service'], 'Notification Service circuit breaker registered');

  assert.strictEqual(ledgerCircuitBreaker.name, 'ledger-service');
  assert.strictEqual(rabbitmqCircuitBreaker.name, 'rabbitmq-publisher');
  assert.strictEqual(notificationCircuitBreaker.name, 'notification-service');
  console.log(
    '  ✔ Protected services verified in Registry: ledger-service, rabbitmq-publisher, notification-service'
  );

  // 7. Test HTTP Health Endpoint & Prometheus Metrics Exposition
  console.log('\n[7. Testing GET /admin/circuit-breakers & Prometheus Metrics]');
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 7.1 GET /admin/circuit-breakers
    const resAdmin = await fetch(`${baseUrl}/admin/circuit-breakers`);
    assert.strictEqual(resAdmin.status, 200, 'Admin endpoint returns HTTP 200');
    const adminJson = await resAdmin.json();
    assert.strictEqual(adminJson.success, true);
    assert.ok(adminJson.data['ledger-service']);
    assert.ok(adminJson.data['rabbitmq-publisher']);
    assert.ok(adminJson.data['notification-service']);
    assert.strictEqual(adminJson.data['ledger-service'].state, 'CLOSED');
    console.log('  ✔ GET /admin/circuit-breakers returned all circuit breaker statuses');

    // 7.2 Test /api/v1/admin/circuit-breakers alias
    const resApiAdmin = await fetch(`${baseUrl}/api/v1/admin/circuit-breakers`);
    assert.strictEqual(resApiAdmin.status, 200);

    // 7.3 Prometheus Metrics Exposition
    syncCircuitBreakerMetrics();
    const metricsOutput = await register.metrics();
    assert.ok(metricsOutput.includes('vaultcore_circuit_breaker_state'));
    assert.ok(metricsOutput.includes('vaultcore_circuit_breaker_fail_fast_total'));
    assert.ok(metricsOutput.includes('vaultcore_circuit_breaker_failures_total'));
    assert.ok(metricsOutput.includes('vaultcore_circuit_breaker_transitions_total'));
    assert.ok(metricsOutput.includes('vaultcore_circuit_breaker_recoveries_total'));
    console.log(
      '  ✔ Prometheus metrics tracked state, fail-fast, failures, transitions, and recoveries'
    );
  } finally {
    await new Promise((resolve) => testServer.close(resolve));
    await Promise.allSettled([
      rateLimiterService.close(),
      accountCache.redis?.quit(),
      lockService.redis?.quit(),
    ]);
  }

  console.log('\n========================================================================');
  console.log(' ✔ ALL PROMPT 14 CIRCUIT BREAKER TESTS PASSED SUCCESSFULLY');
  console.log('========================================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✖ Circuit breaker test failed:', err);
    process.exit(1);
  });
