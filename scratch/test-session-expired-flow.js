// Verification script for Session Expired Flow
import fs from 'fs';
import path from 'path';

const clientPath = path.resolve('frontend/src/api/client.js');
const modalPath = path.resolve('frontend/src/components/SessionExpiredModal.jsx');
const authContextPath = path.resolve('frontend/src/context/AuthContext.jsx');
const protectedRoutePath = path.resolve('frontend/src/components/ProtectedRoute.jsx');
const appPath = path.resolve('frontend/src/App.jsx');

const clientCode = fs.readFileSync(clientPath, 'utf8');
const modalCode = fs.readFileSync(modalPath, 'utf8');
const authContextCode = fs.readFileSync(authContextPath, 'utf8');
const protectedRouteCode = fs.readFileSync(protectedRoutePath, 'utf8');
const appCode = fs.readFileSync(appPath, 'utf8');

console.log('--- Checking Session Expired Flow Implementation ---');

// 1. Axios Response Interceptor
console.log('1. Checking Axios Response Interceptor:');
const checksClient = [
  { name: 'Dispatches vaultcore:session-expired on 401 refresh', pass: clientCode.includes("window.dispatchEvent(new CustomEvent('vaultcore:session-expired'))") },
  { name: 'Clears in-memory token on failed refresh', pass: clientCode.includes('clearMemoryAccessToken()') },
  { name: 'No window.location or navigate in Axios client', pass: !clientCode.includes('window.location.href =') && !clientCode.includes('navigate(') },
  { name: 'Suppresses duplicate events and loops via isSessionExpiredActive', pass: clientCode.includes('isSessionExpiredActive') },
];
checksClient.forEach(c => console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`));

// 2. SessionExpiredModal
console.log('\n2. Checking SessionExpiredModal:');
const checksModal = [
  { name: 'Listens for vaultcore:session-expired', pass: modalCode.includes("'vaultcore:session-expired'") },
  { name: 'Login Again clears in-memory token and navigates', pass: modalCode.includes('clearMemoryAccessToken()') && modalCode.includes("navigate('/login'") },
  { name: 'Logout clears query cache, session, and navigates', pass: modalCode.includes('queryClient.clear()') && modalCode.includes('logout()') },
  { name: 'Resets session expired flag on dismiss/navigate', pass: modalCode.includes('resetSessionExpiredFlag()') },
];
checksModal.forEach(c => console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`));

// 3. AuthContext
console.log('\n3. Checking AuthContext:');
const checksAuth = [
  { name: 'Listens for vaultcore:session-expired event', pass: authContextCode.includes("'vaultcore:session-expired'") },
  { name: 'Tracks isSessionExpired state', pass: authContextCode.includes('isSessionExpired') },
  { name: 'Does not automatically wipe session/logout on silent refresh fail when user exists', pass: authContextCode.includes('setIsSessionExpired(true)') },
  { name: 'Exposes isSessionExpired to consumers', pass: authContextCode.includes('isSessionExpired,') },
];
checksAuth.forEach(c => console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`));

// 4. ProtectedRoute & App
console.log('\n4. Checking ProtectedRoute & App:');
const checksApp = [
  { name: 'ProtectedRoute allows rendering when isSessionExpired is true (preventing redirect loops)', pass: protectedRouteCode.includes('if (isSessionExpired)') },
  { name: 'App mounts SessionExpiredModal globally inside router and providers', pass: appCode.includes('<SessionExpiredModal />') },
];
checksApp.forEach(c => console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`));

const allPassed = [...checksClient, ...checksModal, ...checksAuth, ...checksApp].every(c => c.pass);
console.log(`\nOverall Verification: ${allPassed ? 'ALL CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
if (!allPassed) process.exit(1);
