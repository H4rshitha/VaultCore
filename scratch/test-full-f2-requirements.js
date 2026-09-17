import fs from 'fs';
import path from 'path';

console.log('=== VAULTCORE COMPREHENSIVE F2 VERIFICATION ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function verify() {
  const testEmail = `f2_user_${Date.now()}@vaultcore.io`;
  const password = 'SecurePassword2026!';
  let receivedCookie = null;
  let accessToken = null;

  // 1. Signup creates a new user through the Auth Service (via Gateway)
  console.log('[1/6] Testing: Signup creates a new user through the Auth Service...');
  try {
    const signupRes = await fetch('http://localhost:3000/api/v1/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
      },
      body: JSON.stringify({
        firstName: 'Alex',
        lastName: 'Morgan',
        email: testEmail,
        password,
        role: 'CUSTOMER',
      }),
    });

    const signupData = await signupRes.json();
    assert(signupRes.status === 201, `Signup endpoint returns 201 Created (got ${signupRes.status})`);
    assert(signupData.success === true, 'Signup response indicates success: true');
    assert(signupData.data?.user?.email === testEmail, `User created with email: ${signupData.data?.user?.email}`);

    // Check for Set-Cookie header
    const setCookie = signupRes.headers.get('set-cookie');
    assert(setCookie !== null && setCookie.includes('refreshToken='), `Set-Cookie contains refreshToken (${setCookie ? 'Found' : 'Missing'})`);
    assert(setCookie && setCookie.toLowerCase().includes('httponly'), 'Refresh token cookie is flagged HttpOnly');
    receivedCookie = setCookie;
  } catch (err) {
    assert(false, `Signup failed: ${err.message}`);
  }

  // 2. Login authenticates through the API Gateway
  console.log('\n[2/6] Testing: Login authenticates through the API Gateway...');
  try {
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
      },
      body: JSON.stringify({
        email: testEmail,
        password,
      }),
    });

    const loginData = await loginRes.json();
    assert(loginRes.status === 200, `Login returns 200 OK (got ${loginRes.status})`);
    assert(loginData.success === true, 'Login response indicates success: true');
    accessToken = loginData.data?.tokens?.accessToken || loginData.data?.accessToken;
    assert(typeof accessToken === 'string' && accessToken.length > 20, 'Gateway returned valid JWT access token');

    const setCookie = loginRes.headers.get('set-cookie');
    assert(setCookie !== null && setCookie.includes('refreshToken='), 'Login response sets HttpOnly refreshToken cookie');
    if (setCookie) {
      receivedCookie = setCookie;
    }
  } catch (err) {
    assert(false, `Login failed: ${err.message}`);
  }

  // 3. JWT is stored only in memory
  console.log('\n[3/6] Testing: JWT is stored only in memory...');
  const storageFile = fs.readFileSync('frontend/src/utils/storage.js', 'utf8');
  assert(!storageFile.includes('localStorage.setItem(\'vaultcore_access_token\'') && !storageFile.includes('localStorage.setItem("vaultcore_access_token"'), 'Access token is NEVER persisted in localStorage');
  assert(storageFile.includes('let inMemoryAccessToken = null;'), 'Access token stored in memory variable');
  assert(storageFile.includes('setMemoryAccessToken') && storageFile.includes('getMemoryAccessToken'), 'In-memory token getter and setter exported');

  // 4. Refresh token is stored as an HTTP-only cookie
  console.log('\n[4/6] Testing: Refresh token is stored as an HTTP-only cookie...');
  assert(receivedCookie !== null, 'Refresh token received via HTTP header');
  assert(receivedCookie && receivedCookie.toLowerCase().includes('httponly'), 'Cookie contains HttpOnly directive (inaccessible to JavaScript)');
  assert(receivedCookie && receivedCookie.toLowerCase().includes('samesite=lax'), 'Cookie contains SameSite=Lax directive for CSRF protection');

  // 5. Reloading the page keeps the session alive (silent refresh with cookie)
  console.log('\n[5/6] Testing: Reloading the page keeps the session alive via silent refresh...');
  try {
    // Simulate browser sending cookie on page refresh
    const cookieHeader = receivedCookie ? receivedCookie.split(';')[0] : '';
    const refreshRes = await fetch('http://localhost:3000/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({}),
    });

    const refreshData = await refreshRes.json();
    assert(refreshRes.status === 200, `Silent refresh returns 200 OK (got ${refreshRes.status})`);
    const newAccessToken = refreshData.data?.accessToken || refreshData.data?.tokens?.accessToken;
    assert(typeof newAccessToken === 'string' && newAccessToken.length > 20, 'Session restored with fresh JWT access token');
  } catch (err) {
    assert(false, `Session restore failed: ${err.message}`);
  }

  // 6. Protected routes redirect correctly when logged out
  console.log('\n[6/6] Testing: Protected routes redirect correctly when logged out...');
  const protectedRouteFile = fs.readFileSync('frontend/src/components/ProtectedRoute.jsx', 'utf8');
  assert(protectedRouteFile.includes('!isAuthenticated'), 'ProtectedRoute checks isAuthenticated state');
  assert(protectedRouteFile.includes('<Navigate to="/login"'), 'ProtectedRoute redirects unauthenticated visitors to /login');
  assert(protectedRouteFile.includes('state={{ from: location }}'), 'ProtectedRoute preserves target location state for post-login redirect');

  const appRoutesFile = fs.readFileSync('frontend/src/routes/AppRoutes.jsx', 'utf8');
  assert(appRoutesFile.includes('<ProtectedRoute>'), 'Dashboard routes wrapped in ProtectedRoute guard');

  console.log(`\n======================================================`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

verify().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
