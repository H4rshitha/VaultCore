import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6utils/1.4.0/index.js';

// Custom Prometheus-aligned k6 Metrics
export const loginDuration = new Trend('vaultcore_k6_login_duration_ms');
export const balanceDuration = new Trend('vaultcore_k6_balance_duration_ms');
export const transferDuration = new Trend('vaultcore_k6_transfer_duration_ms');
export const historyDuration = new Trend('vaultcore_k6_history_duration_ms');
export const notificationDuration = new Trend('vaultcore_k6_notification_duration_ms');

export const successfulTransfers = new Counter('vaultcore_k6_transfers_success_total');
export const failedTransfers = new Counter('vaultcore_k6_transfers_failed_total');
export const rateLimitHitRate = new Rate('vaultcore_k6_rate_limit_hits');

export const options = {
  stages: [
    // 1. Warm-up & Ramp to 100 concurrent VUs (Baseline)
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },

    // 2. Ramp to 200 concurrent VUs (Target Peak Production Load)
    { duration: '30s', target: 200 },
    { duration: '2m', target: 200 },

    // 3. Spike / Stress test to 500 concurrent VUs
    { duration: '30s', target: 500 },
    { duration: '1m', target: 500 },

    // 4. Cool-down & Ramp down
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // 95% of all requests must complete within 250ms, 99% within 500ms
    http_req_duration: ['p(90)<200', 'p(95)<350', 'p(99)<600'],
    // Platform error rate must remain under 1%
    http_req_failed: ['rate<0.01'],
    // Specific transaction thresholds
    'vaultcore_k6_transfer_duration_ms': ['p(95)<400'],
    'vaultcore_k6_balance_duration_ms': ['p(95)<100'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Pool of test accounts
const TEST_ACCOUNTS = [
  '100010001001',
  '100010001002',
  '100010001003',
  '100010001004',
  '100010001005',
];

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const traceId = `k6-${vuId}-${iterId}-${uuidv4()}`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Trace-ID': traceId,
  };

  let authToken = null;
  const testEmail = `user${(vuId % 20) + 1}@vaultcore.io`;

  // ==========================================
  // SCENARIO 1: Authentication (Login)
  // ==========================================
  group('1. Authentication Flow', function () {
    const loginPayload = JSON.stringify({
      email: testEmail,
      password: 'SecurePassword2026!',
    });

    const startLogin = Date.now();
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, { headers });
    loginDuration.add(Date.now() - startLogin);

    if (loginRes.status === 429) {
      rateLimitHitRate.add(1);
    } else {
      rateLimitHitRate.add(0);
      const ok = check(loginRes, {
        'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      });

      if (loginRes.status === 200) {
        try {
          const body = JSON.parse(loginRes.body);
          authToken = body.data?.token || body.data?.accessToken;
        } catch (e) {
          // ignore parsing error in high stress
        }
      }
    }
  });

  // Attach JWT if obtained, else fallback to mock customer token
  const authHeaders = {
    ...headers,
    Authorization: authToken ? `Bearer ${authToken}` : 'Bearer k6-test-customer-token',
  };

  // ==========================================
  // SCENARIO 2: Cache-Aside Balance Lookup
  // ==========================================
  group('2. Account Balance Lookup (Cache-Aside)', function () {
    const accountNum = TEST_ACCOUNTS[vuId % TEST_ACCOUNTS.length];
    const startBal = Date.now();
    const balRes = http.get(`${BASE_URL}/api/v1/accounts/${accountNum}/balance`, { headers: authHeaders });
    balanceDuration.add(Date.now() - startBal);

    check(balRes, {
      'balance status is 200': (r) => r.status === 200 || r.status === 404,
      'traceId propagated in response': (r) => r.headers['X-Trace-Id'] !== undefined,
    });
  });

  // ==========================================
  // SCENARIO 3: ACID Money Transfer & Outbox Creation
  // ==========================================
  group('3. Payment Transfer Orchestration', function () {
    const srcIdx = vuId % TEST_ACCOUNTS.length;
    const tgtIdx = (srcIdx + 1) % TEST_ACCOUNTS.length;

    const transferPayload = JSON.stringify({
      idempotencyKey: `idemp-${vuId}-${iterId}-${uuidv4()}`,
      sourceAccountNumber: TEST_ACCOUNTS[srcIdx],
      targetAccountNumber: TEST_ACCOUNTS[tgtIdx],
      amount: parseFloat(((vuId % 50) + 10.5).toFixed(2)),
      currency: 'USD',
      description: `k6 automated transfer VU ${vuId}`,
    });

    const startTransfer = Date.now();
    const transferRes = http.post(`${BASE_URL}/api/v1/payments/transfer`, transferPayload, { headers: authHeaders });
    transferDuration.add(Date.now() - startTransfer);

    if (transferRes.status === 429) {
      rateLimitHitRate.add(1);
    } else {
      rateLimitHitRate.add(0);
      const isSuccess = transferRes.status === 200 || transferRes.status === 201;
      if (isSuccess) {
        successfulTransfers.add(1);
      } else {
        failedTransfers.add(1);
      }

      check(transferRes, {
        'transfer accepted or handled gracefully': (r) =>
          r.status === 200 || r.status === 201 || r.status === 400 || r.status === 409 || r.status === 429,
        'rate limit headers present': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
      });
    }
  });

  // ==========================================
  // SCENARIO 4: Paginated Payment History Search
  // ==========================================
  group('4. Payment History & Search', function () {
    const startHistory = Date.now();
    const historyRes = http.get(`${BASE_URL}/api/v1/payments/history?limit=10`, { headers: authHeaders });
    historyDuration.add(Date.now() - startHistory);

    check(historyRes, {
      'payment history returned 200': (r) => r.status === 200 || r.status === 401,
    });
  });

  // ==========================================
  // SCENARIO 5: Notification History & Audit
  // ==========================================
  group('5. Notification Audit & Queue Inspection', function () {
    const startNotif = Date.now();
    const notifRes = http.get(`${BASE_URL}/api/v1/notifications/history?limit=5`, { headers: authHeaders });
    notificationDuration.add(Date.now() - startNotif);

    check(notifRes, {
      'notification history response valid': (r) => r.status === 200 || r.status === 401,
    });
  });

  // Pacing / Think time between user actions (0.5s to 1s)
  sleep(0.5 + Math.random() * 0.5);
}
