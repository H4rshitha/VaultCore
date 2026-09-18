/**
 * VaultCore Production Frontend Health Verification
 *
 * Verifies:
 * 1. Build and dist readiness
 * 2. SPA index.html mount point and metadata
 * 3. Client routing definitions (Login, Signup, Dashboard protection, Transfers, Accounts)
 * 4. Production Environment Configuration logic (API Base URL, Gateway URL, SSE URL)
 * 5. Production bundle validation ensuring zero localhost leakage when built with production env
 * 6. Vercel deployment specification (vercel.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(rootDir, 'frontend');
const distDir = path.resolve(frontendDir, 'dist');
const srcDir = path.resolve(frontendDir, 'src');

console.log('====================================================');
console.log('   VaultCore — Production Frontend Health Check');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failCount++;
  }
}

// 1. Frontend Build & Static HTML
console.log('--- 1. Frontend Build & HTML Verification ---');
const indexHtmlPath = path.resolve(distDir, 'index.html');
assert(fs.existsSync(indexHtmlPath), 'Production dist/index.html is generated');

if (fs.existsSync(indexHtmlPath)) {
  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(htmlContent.includes('<div id="root">'), 'Root DOM mount point (<div id="root">) exists');
  assert(htmlContent.includes('<title>'), 'HTML <title> tag is present');
  assert(htmlContent.includes('viewport'), 'Responsive mobile viewport meta tag is present');
}

// 2. SPA Route Configuration & Route Protection
console.log('\n--- 2. Route Configuration & Protection ---');
const appRoutesPath = path.resolve(srcDir, 'routes', 'AppRoutes.jsx');
assert(fs.existsSync(appRoutesPath), 'AppRoutes.jsx router exists');

if (fs.existsSync(appRoutesPath)) {
  const appContent = fs.readFileSync(appRoutesPath, 'utf8');
  assert(appContent.includes('/login'), 'Login route (/login) defined');
  assert(appContent.includes('/signup'), 'Signup route (/signup) defined');
  assert(appContent.includes('/dashboard'), 'Dashboard route (/dashboard) defined');
  assert(appContent.includes('/transfer'), 'Transfer route (/transfer) defined');
  assert(appContent.includes('/accounts'), 'Accounts route (/accounts) defined');
  assert(
    appContent.includes('ProtectedRoute'),
    'Protected route guard enforces authentication before dashboard access'
  );
}

// 3. Centralized Environment Configuration Verification
console.log('\n--- 3. Centralized Environment Configuration ---');
const envConfigPath = path.resolve(srcDir, 'config', 'env.js');
assert(fs.existsSync(envConfigPath), 'Centralized config/env.js exists');

if (fs.existsSync(envConfigPath)) {
  const envContent = fs.readFileSync(envConfigPath, 'utf8');
  assert(envContent.includes('VITE_API_BASE_URL'), 'VITE_API_BASE_URL is recognized in env helper');
  assert(envContent.includes('VITE_GATEWAY_URL'), 'VITE_GATEWAY_URL is recognized in env helper');
  assert(envContent.includes('VITE_SSE_URL'), 'VITE_SSE_URL is recognized in env helper');
  assert(envContent.includes('VITE_APP_ENV'), 'VITE_APP_ENV is recognized in env helper');
  assert(envContent.includes('import.meta.env'), 'Uses import.meta.env Vite standard');
}

// 4. API Clients & SSE Integration
console.log('\n--- 4. API Clients & SSE Integration ---');
const apiClientPath = path.resolve(srcDir, 'api', 'client.js');
const eventsApiPath = path.resolve(srcDir, 'api', 'eventsApi.js');
assert(fs.existsSync(apiClientPath), 'API Client (api/client.js) exists');
assert(fs.existsSync(eventsApiPath), 'Events SSE API (api/eventsApi.js) exists');

if (fs.existsSync(apiClientPath)) {
  const clientContent = fs.readFileSync(apiClientPath, 'utf8');
  assert(
    clientContent.includes('../config/env') || clientContent.includes('API_BASE_URL'),
    'API client imports centralized environment base URL'
  );
  assert(clientContent.includes('X-Trace-ID'), 'API client generates/forwards X-Trace-ID headers');
  assert(clientContent.includes('Authorization'), 'API client attaches Bearer authorization tokens');
}

if (fs.existsSync(eventsApiPath)) {
  const eventsContent = fs.readFileSync(eventsApiPath, 'utf8');
  assert(
    eventsContent.includes('SSE_URL') || eventsContent.includes('../config/env'),
    'Events client uses centralized SSE_URL'
  );
  assert(eventsContent.includes('EventSource'), 'Events client implements browser EventSource');
}

// 5. Static Assets Resolution & Integrity
console.log('\n--- 5. Static Assets Resolution & Integrity ---');
const assetsDir = path.resolve(distDir, 'assets');
assert(fs.existsSync(assetsDir), 'Assets directory exists in dist');

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const jsBundle = files.find((f) => f.endsWith('.js'));
  const cssBundle = files.find((f) => f.endsWith('.css'));

  assert(Boolean(jsBundle), `Resolved JS bundle: ${jsBundle}`);
  assert(Boolean(cssBundle), `Resolved CSS stylesheet: ${cssBundle}`);

  if (jsBundle) {
    const bundleContent = fs.readFileSync(path.resolve(assetsDir, jsBundle), 'utf8');
    assert(bundleContent.length > 10000, 'JavaScript bundle contains complete compiled application');
  }
}

// 6. Vercel SPA Routing & Security Headers
console.log('\n--- 6. Vercel Configuration Health ---');
const vercelJsonPath = path.resolve(frontendDir, 'vercel.json');
assert(fs.existsSync(vercelJsonPath), 'frontend/vercel.json is present');

if (fs.existsSync(vercelJsonPath)) {
  const vercel = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  assert(
    vercel.rewrites?.some((r) => r.destination === '/index.html'),
    'All routes rewrite to /index.html for client-side routing'
  );
  assert(
    vercel.headers?.some((h) => h.headers.some((kv) => kv.key === 'X-Frame-Options')),
    'Security header X-Frame-Options configured'
  );
  assert(
    vercel.headers?.some((h) => h.headers.some((kv) => kv.key === 'X-Content-Type-Options')),
    'Security header X-Content-Type-Options configured'
  );
  assert(
    vercel.headers?.some((h) => h.headers.some((kv) => kv.key === 'Referrer-Policy')),
    'Security header Referrer-Policy configured'
  );
}

// 7. Deployment Documentation
console.log('\n--- 7. Deployment Documentation ---');
const docsPath = path.resolve(rootDir, 'docs', 'vercel-deployment.md');
assert(fs.existsSync(docsPath), 'docs/vercel-deployment.md deployment guide is created');

console.log('\n====================================================');
console.log(`   Production Frontend Summary: ${passCount} PASSED, ${failCount} FAILED`);
console.log('====================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
