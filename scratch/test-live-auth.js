import http from 'http';
import { app as authApp } from '../services/auth-service/src/app.js';
import { app as gatewayApp } from '../services/gateway/src/app.js';

console.log('=== TESTING LIVE AUTH SERVICE & GATEWAY INTEGRATION ===');

async function testAuth() {
  // Start Auth Service on port 3001
  const authServer = http.createServer(authApp);
  await new Promise((resolve) => authServer.listen(3001, '127.0.0.1', resolve));
  console.log('  ✓ Auth Service started on http://127.0.0.1:3001');

  // Start Gateway on port 3000
  const gatewayServer = http.createServer(gatewayApp);
  await new Promise((resolve) => gatewayServer.listen(3000, '127.0.0.1', resolve));
  console.log('  ✓ API Gateway started on http://127.0.0.1:3000');

  try {
    const testEmail = `testuser_${Date.now()}@vaultcore.io`;

    // 1. Test Signup via Gateway
    console.log(
      `\n[1/3] Testing POST http://127.0.0.1:3000/api/v1/auth/signup for ${testEmail}...`
    );
    const signupRes = await fetch('http://127.0.0.1:3000/api/v1/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        firstName: 'Harshitha',
        lastName: 'Palaram',
        email: testEmail,
        password: 'SecurePassword2026!',
        role: 'CUSTOMER',
      }),
    });

    console.log(`  Signup status: ${signupRes.status}`);
    const corsOrigin = signupRes.headers.get('access-control-allow-origin');
    const corsCreds = signupRes.headers.get('access-control-allow-credentials');
    console.log(`  CORS Allow-Origin: ${corsOrigin}`);
    console.log(`  CORS Allow-Credentials: ${corsCreds}`);

    const signupBody = await signupRes.json();
    console.log('  Signup response:', JSON.stringify(signupBody, null, 2));

    if (signupRes.status !== 201) {
      throw new Error(`Signup failed with status ${signupRes.status}`);
    }

    // 2. Test Login via Gateway
    console.log(`\n[2/3] Testing POST http://127.0.0.1:3000/api/v1/auth/login...`);
    const loginRes = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'SecurePassword2026!',
      }),
    });

    console.log(`  Login status: ${loginRes.status}`);
    const loginBody = await loginRes.json();
    console.log('  Login response:', JSON.stringify(loginBody, null, 2));

    if (loginRes.status !== 200) {
      throw new Error(`Login failed with status ${loginRes.status}`);
    }

    // 3. Test Refresh Token via Gateway
    console.log(`\n[3/3] Testing POST http://127.0.0.1:3000/api/v1/auth/refresh...`);
    const refreshToken = loginBody.data?.tokens?.refreshToken || loginBody.data?.refreshToken;
    const refreshRes = await fetch('http://127.0.0.1:3000/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        refreshToken,
      }),
    });

    console.log(`  Refresh status: ${refreshRes.status}`);
    const refreshBody = await refreshRes.json();
    console.log('  Refresh response:', JSON.stringify(refreshBody, null, 2));

    if (refreshRes.status !== 200) {
      throw new Error(`Refresh failed with status ${refreshRes.status}`);
    }

    console.log('\n======================================================');
    console.log('ALL LIVE AUTH INTEGRATION TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await new Promise((resolve) => authServer.close(resolve));
    await new Promise((resolve) => gatewayServer.close(resolve));
  }
}

testAuth().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
