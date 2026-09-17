import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const logsDir = path.join(rootDir, 'smoke-logs');

const GATEWAY_URL = (process.env.GATEWAY_URL || 'http://localhost:3000').replace(/\/$/, '');

console.log(`=== VaultCore Automated Smoke Tests ===`);
console.log(`Target Gateway: ${GATEWAY_URL}\n`);

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const smokeResults = [];

async function executeTest(name, method, endpoint, options = {}) {
  const url = `${GATEWAY_URL}${endpoint}`;
  const startTime = Date.now();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const fetchOptions = {
    method,
    headers,
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  let status = null;
  let responseData = null;
  let error = null;

  try {
    const res = await fetch(url, fetchOptions);
    status = res.status;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await res.json();
    } else {
      responseData = await res.text();
    }

    const durationMs = Date.now() - startTime;
    const isSuccess = status >= 200 && status < 300;

    const record = {
      name,
      method,
      endpoint,
      status,
      durationMs,
      success: isSuccess,
      request: {
        headers,
        body: options.body || null,
      },
      response: responseData,
    };

    smokeResults.push(record);

    if (!isSuccess) {
      console.error(`❌ FAIL: [${method} ${endpoint}] Status: ${status} (${durationMs}ms)`);
      console.error(`   Error details:`, JSON.stringify(responseData));
      throw new Error(`Smoke test failed at [${method} ${endpoint}] with status ${status}`);
    }

    console.log(`✅ PASS: [${method} ${endpoint}] Status: ${status} (${durationMs}ms)`);
    return responseData;
  } catch (err) {
    if (!status) {
      const durationMs = Date.now() - startTime;
      const record = {
        name,
        method,
        endpoint,
        status: 'NETWORK_ERROR',
        durationMs,
        success: false,
        error: err.message,
      };
      smokeResults.push(record);
      console.error(`❌ NETWORK_ERROR: [${method} ${endpoint}] - ${err.message}`);
    }
    throw err;
  }
}

async function runAllSmokeTests() {
  try {
    // 1. Health & Documentation Endpoints
    console.log('--- 1. Gateway Health & Observability Endpoints ---');
    await executeTest('Gateway Health', 'GET', '/health');
    await executeTest('Gateway Liveness', 'GET', '/health/live');
    await executeTest('Gateway Readiness', 'GET', '/health/ready');
    await executeTest('Prometheus Metrics', 'GET', '/metrics');
    await executeTest('API Documentation (Swagger)', 'GET', '/docs');

    // 2. Authentication Flow
    console.log('\n--- 2. Customer Authentication Flow ---');
    const timestamp = Date.now();
    const testEmail = `smoke.user.${timestamp}@vaultcore.io`;
    const testPassword = 'Password123!';

    const signupRes = await executeTest('Customer Signup', 'POST', '/auth/signup', {
      body: {
        email: testEmail,
        password: testPassword,
        firstName: 'Smoke',
        lastName: 'Tester',
        role: 'CUSTOMER',
      },
    });

    const loginRes = await executeTest('Customer Login', 'POST', '/auth/login', {
      body: {
        email: testEmail,
        password: testPassword,
      },
    });

    const token =
      loginRes?.data?.tokens?.accessToken ||
      loginRes?.data?.accessToken ||
      loginRes?.accessToken ||
      signupRes?.data?.tokens?.accessToken;

    if (!token) {
      throw new Error('Could not extract JWT access token from login response.');
    }
    console.log('   🔑 Extracted JWT token successfully.');

    const authHeaders = { Authorization: `Bearer ${token}` };

    // 3. Account Flow
    console.log('\n--- 3. Account Management Flow ---');
    await executeTest('List User Accounts', 'GET', '/accounts', { headers: authHeaders });

    const createAccountRes = await executeTest('Create Checking Account', 'POST', '/accounts', {
      headers: authHeaders,
      body: {
        type: 'CHECKING',
        currency: 'USD',
        initialDeposit: 1500,
      },
    });

    const accountNumber =
      createAccountRes?.data?.accountNumber ||
      createAccountRes?.data?.account?.accountNumber ||
      '100010001001';

    console.log(`   🏦 Using Account Number: ${accountNumber}`);

    await executeTest('Get Account Details', 'GET', `/accounts/${accountNumber}`, { headers: authHeaders });
    await executeTest('Get Account Balance', 'GET', `/accounts/${accountNumber}/balance`, { headers: authHeaders });

    // 4. Payment Flow
    console.log('\n--- 4. Payment & Transfer Flow ---');
    await executeTest('Get Payment History', 'GET', '/payments/history', { headers: authHeaders });
    await executeTest('Get Payment Summary', 'GET', '/payments/summary', { headers: authHeaders });

    // 5. Notification Flow
    console.log('\n--- 5. Notification System Flow ---');
    await executeTest('Get Notification History', 'GET', '/notifications/history', { headers: authHeaders });

    // 6. Ledger Flow
    console.log('\n--- 6. Core Ledger Audit Flow ---');
    await executeTest('Get Ledger Entries for Account', 'GET', `/ledger/accounts/${accountNumber}/entries`, {
      headers: authHeaders,
    });

    console.log('\n======================================================');
    console.log(`🎉 All ${smokeResults.length}/${smokeResults.length} Smoke Tests Passed Successfully!`);

    const reportPath = path.join(logsDir, 'smoke-test-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          targetUrl: GATEWAY_URL,
          timestamp: new Date().toISOString(),
          totalTests: smokeResults.length,
          passed: smokeResults.filter((r) => r.success).length,
          failed: smokeResults.filter((r) => !r.success).length,
          results: smokeResults,
        },
        null,
        2
      )
    );
    console.log(`📄 Smoke test report saved to: ${reportPath}`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Smoke Test Suite Terminated with Error:', err.message);
    const reportPath = path.join(logsDir, 'smoke-test-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          targetUrl: GATEWAY_URL,
          timestamp: new Date().toISOString(),
          totalTests: smokeResults.length,
          passed: smokeResults.filter((r) => r.success).length,
          failed: smokeResults.filter((r) => !r.success).length,
          results: smokeResults,
          error: err.message,
        },
        null,
        2
      )
    );
    process.exit(1);
  }
}

runAllSmokeTests();
