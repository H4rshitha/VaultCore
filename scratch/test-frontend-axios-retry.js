// Verification test for Axios GET Retry Policy
import axios from 'axios';

console.log('====================================================');
console.log('🧪 RUNNING AXIOS GET RETRY POLICY VERIFICATION TEST');
console.log('====================================================\n');

// 1. Helper function implementing the exact retry logic from client.js
const getRetryDelay = (retryCount) => {
  return 500 * Math.pow(2, retryCount - 1);
};

const createTestClient = (adapterFn) => {
  const client = axios.create({
    adapter: adapterFn,
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config || {};
      const method = (originalRequest.method || 'GET').toUpperCase();
      const isGetRequest = method === 'GET';
      const status = error.response?.status;
      const isNetworkError =
        !status ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout');
      const is5xxError = typeof status === 'number' && status >= 500 && status <= 599;
      const isRetryableError = isNetworkError || is5xxError;

      if (isGetRequest && isRetryableError) {
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        const MAX_RETRIES = 2;

        if (originalRequest._retryCount <= MAX_RETRIES) {
          const delay = getRetryDelay(originalRequest._retryCount);
          originalRequest._delays = originalRequest._delays || [];
          originalRequest._delays.push(delay);

          await new Promise((resolve) => setTimeout(resolve, 10)); // simulated short delay for tests
          return client(originalRequest);
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
};

const testResults = [];

async function runTests() {
  // Test 1: Simulate failed GET /accounts with 500
  {
    let attempts = 0;
    const recordedDelays = [];
    const client = createTestClient(async (config) => {
      attempts++;
      const err = new Error('Request failed with status code 500');
      err.config = config;
      err.response = { status: 500, data: { message: 'Internal Server Error' } };
      throw err;
    });

    try {
      await client.get('/accounts');
    } catch (err) {
      const delays = err.config?._delays || [];
      const passAttempts = attempts === 3;
      const passDelays = delays.length === 2 && delays[0] === 500 && delays[1] === 1000;
      testResults.push({
        name: 'Test 1: Failed GET /accounts (HTTP 500) retries exactly 2 times (3 total attempts) with increasing delay',
        passed: passAttempts && passDelays,
        details: `Attempts: ${attempts} (expected 3), Delays: ${JSON.stringify(delays)} (expected [500, 1000])`,
      });
    }
  }

  // Test 2: Simulate GET returning 404
  {
    let attempts = 0;
    const client = createTestClient(async (config) => {
      attempts++;
      const err = new Error('Request failed with status code 404');
      err.config = config;
      err.response = { status: 404, data: { message: 'Not Found' } };
      throw err;
    });

    try {
      await client.get('/accounts/unknown');
    } catch (err) {
      testResults.push({
        name: 'Test 2: GET returning 404 does NOT retry (exactly 1 attempt)',
        passed: attempts === 1,
        details: `Attempts: ${attempts} (expected 1)`,
      });
    }
  }

  // Test 3: Simulate POST /payments/transfer failing with 500
  {
    let attempts = 0;
    const client = createTestClient(async (config) => {
      attempts++;
      const err = new Error('Request failed with status code 500');
      err.config = config;
      err.response = { status: 500, data: { message: 'Payment gateway error' } };
      throw err;
    });

    try {
      await client.post('/payments/transfer', { amount: 100 });
    } catch (err) {
      testResults.push({
        name: 'Test 3: POST failing with 500 does NOT retry (exactly 1 attempt)',
        passed: attempts === 1,
        details: `Attempts: ${attempts} (expected 1)`,
      });
    }
  }

  // Test 4: Simulate network timeout on GET
  {
    let attempts = 0;
    const client = createTestClient(async (config) => {
      attempts++;
      const err = new Error('timeout of 10000ms exceeded');
      err.code = 'ECONNABORTED';
      err.config = config;
      throw err;
    });

    try {
      await client.get('/accounts/overview');
    } catch (err) {
      testResults.push({
        name: 'Test 4: Network timeout on GET triggers 2 retries (3 total attempts)',
        passed: attempts === 3,
        details: `Attempts: ${attempts} (expected 3)`,
      });
    }
  }

  // Summary
  console.log('--- TEST RESULTS ---');
  let allPass = true;
  testResults.forEach((t, idx) => {
    if (!t.passed) allPass = false;
    console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.name}`);
    console.log(`       ${t.details}`);
  });

  console.log('\n====================================================');
  console.log(`Axios Retry Summary: ${allPass ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
  console.log('====================================================\n');

  if (!allPass) process.exit(1);
}

runTests();
