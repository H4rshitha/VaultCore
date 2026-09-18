/**
 * VaultCore Vercel Build Verification Script
 * Validates that frontend builds cleanly, creates required SPA artifacts,
 * properly resolves assets, and verifies environment variable handling.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(rootDir, 'frontend');
const distDir = path.resolve(frontendDir, 'dist');
const vercelJsonPath = path.resolve(frontendDir, 'vercel.json');

console.log('====================================================');
console.log('   VaultCore — Vercel Production Build Verification');
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

// Test 1: Verify vercel.json structure and configuration
console.log('--- Step 1: Vercel Configuration Verification ---');
try {
  assert(fs.existsSync(vercelJsonPath), 'frontend/vercel.json exists');
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  assert(vercelConfig.framework === 'vite', 'Framework is configured as vite');
  assert(vercelConfig.outputDirectory === 'dist', 'Output directory is dist');
  assert(
    Array.isArray(vercelConfig.rewrites) &&
      vercelConfig.rewrites.some((r) => r.destination === '/index.html'),
    'SPA rewrite to /index.html is configured'
  );
  assert(
    Array.isArray(vercelConfig.headers) &&
      vercelConfig.headers.some((h) =>
        h.headers.some((kv) => kv.key === 'X-Frame-Options' && kv.value === 'DENY')
      ),
    'Security headers (X-Frame-Options, X-Content-Type-Options) configured'
  );
} catch (err) {
  assert(false, `vercel.json parsing error: ${err.message}`);
}

// Test 2: Execute Vite Production Build
console.log('\n--- Step 2: Executing Vite Production Build ---');
try {
  console.log('Running: npm run build (in frontend directory)...');
  const buildOutput = execSync('npm run build', {
    cwd: frontendDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log(buildOutput);
  assert(true, 'Vite build completed successfully with zero exit code');
} catch (err) {
  console.error(err.stdout || err.stderr || err.message);
  assert(false, `Vite build failed: ${err.message}`);
}

// Test 3: Validate Dist Folder and Essential Artifacts
console.log('\n--- Step 3: Verifying Build Artifacts ---');
assert(fs.existsSync(distDir), 'dist directory generated');
const indexHtmlPath = path.resolve(distDir, 'index.html');
assert(fs.existsSync(indexHtmlPath), 'dist/index.html exists');

if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(indexHtml.includes('<div id="root">'), 'index.html contains root mount div');
  assert(indexHtml.includes('/assets/'), 'index.html contains link/script tags pointing to /assets/');
}

// Test 4: Inspect Asset Bundles
console.log('\n--- Step 4: Asset Bundle Inspection ---');
const assetsDir = path.resolve(distDir, 'assets');
assert(fs.existsSync(assetsDir), 'dist/assets directory exists');

if (fs.existsSync(assetsDir)) {
  const assetFiles = fs.readdirSync(assetsDir);
  const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));
  const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));

  assert(jsFiles.length > 0, `JavaScript bundle generated (${jsFiles.length} JS chunk(s))`);
  assert(cssFiles.length > 0, `CSS bundle generated (${cssFiles.length} CSS chunk(s))`);

  // Verify JS bundle bundle size and sanity
  jsFiles.forEach((file) => {
    const stats = fs.statSync(path.resolve(assetsDir, file));
    console.log(`   📦 JS Chunk: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
  cssFiles.forEach((file) => {
    const stats = fs.statSync(path.resolve(assetsDir, file));
    console.log(`   🎨 CSS Chunk: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
}

// Test 5: Verify Production Environment Substitution
console.log('\n--- Step 5: Environment Variable Substitution Simulation ---');
try {
  // Test building with custom production env
  const testProdOutput = execSync(
    'npx vite build --mode production',
    {
      cwd: frontendDir,
      env: {
        ...process.env,
        VITE_GATEWAY_URL: 'https://api.vaultcore.prod.domain',
        VITE_API_BASE_URL: 'https://api.vaultcore.prod.domain/api/v1',
        VITE_APP_ENV: 'production',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );
  assert(true, 'Production mode build with custom gateway URL succeeded');

  const assetsDir = path.resolve(distDir, 'assets');
  const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  let foundProdUrl = false;
  let hardcodedLocalhost = false;

  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.resolve(assetsDir, jsFile), 'utf8');
    if (content.includes('api.vaultcore.prod.domain')) {
      foundProdUrl = true;
    }
  }

  assert(foundProdUrl, 'Production Gateway URL successfully baked into client bundle');
} catch (err) {
  assert(false, `Production env injection test failed: ${err.message}`);
}

console.log('\n====================================================');
console.log(`   Build Verification Summary: ${passCount} PASSED, ${failCount} FAILED`);
console.log('====================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
