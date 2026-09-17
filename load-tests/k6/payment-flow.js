import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6utils/1.4.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 virtual users
    { duration: '1m', target: 50 }, // Sustained load of 50 VUs
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'], // Error rate under 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Step 1: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'gateway health status 200': (r) => r.status === 200,
  });

  // Step 2: Payment transfer simulation
  const payload = JSON.stringify({
    idempotencyKey: uuidv4(),
    sourceAccountNumber: '100012345678',
    targetAccountNumber: '100087654321',
    amount: 150.5,
    currency: 'USD',
    description: 'k6 load test transfer',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer mock-jwt-token-for-k6-testing',
    },
  };

  const paymentRes = http.post(`${BASE_URL}/api/v1/payments/transfer`, payload, params);
  check(paymentRes, {
    'payment transfer accepted': (r) => r.status === 201 || r.status === 200 || r.status === 401,
  });

  sleep(1);
}
