import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const deployWorkflowPath = path.join(rootDir, '.github', 'workflows', 'deploy.yml');
const rollbackWorkflowPath = path.join(rootDir, '.github', 'workflows', 'rollback.yml');
const smokeScriptPath = path.join(rootDir, 'scratch', 'run-smoke-tests.js');

console.log('=== VaultCore Stages 5 & 6: Smoke Tests & Rollback Pipeline Verification ===\n');

const checks = [];

function recordCheck(number, name, pass, details = '') {
  checks.push({ number, name, pass, details });
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - [Requirement ${number}] ${name} ${details ? `(${details})` : ''}`);
}

// 0. Check files exist
const deployExists = fs.existsSync(deployWorkflowPath);
const rollbackExists = fs.existsSync(rollbackWorkflowPath);
const smokeScriptExists = fs.existsSync(smokeScriptPath);

if (!deployExists || !rollbackExists || !smokeScriptExists) {
  console.error('\n❌ Missing required files! Aborting verification.');
  console.error({ deployExists, rollbackExists, smokeScriptExists });
  process.exit(1);
}

const deployContent = fs.readFileSync(deployWorkflowPath, 'utf8');
const rollbackContent = fs.readFileSync(rollbackWorkflowPath, 'utf8');
const smokeContent = fs.readFileSync(smokeScriptPath, 'utf8');

// 1. Smoke tests exist for all required endpoints
const requiredEndpoints = ['/health', '/health/live', '/health/ready', '/metrics', '/docs'];
const hasAllEndpoints = requiredEndpoints.every((ep) => smokeContent.includes(ep));
recordCheck(
  1,
  'Smoke tests exist for all required endpoints',
  hasAllEndpoints,
  '/health, /health/live, /health/ready, /metrics, /docs'
);

// 2. Signup/login smoke flow exists
const hasAuthFlow =
  smokeContent.includes('/auth/signup') &&
  smokeContent.includes('/auth/login') &&
  /POST/i.test(smokeContent);
recordCheck(
  2,
  'Signup/login smoke flow exists',
  hasAuthFlow,
  'POST /auth/signup & POST /auth/login tested'
);

// 3. JWT token extraction exists
const hasJwtExtraction = /accessToken/i.test(smokeContent) && /Bearer/i.test(smokeContent);
recordCheck(
  3,
  'JWT token extraction exists',
  hasJwtExtraction,
  'Captures JWT access token for downstream requests'
);

// 4. Account smoke tests exist
const hasAccountFlow =
  smokeContent.includes('/accounts') &&
  smokeContent.includes('/balance') &&
  /GET.*\/accounts/i.test(smokeContent) &&
  /POST.*\/accounts/i.test(smokeContent);
recordCheck(
  4,
  'Account smoke tests exist',
  hasAccountFlow,
  'GET /accounts, POST /accounts, GET /accounts/:id/balance'
);

// 5. Payment smoke tests exist
const hasPaymentFlow =
  smokeContent.includes('/payments/history') && smokeContent.includes('/payments/summary');
recordCheck(
  5,
  'Payment smoke tests exist',
  hasPaymentFlow,
  'GET /payments/history & GET /payments/summary'
);

// 6. Notification smoke tests exist
const hasNotificationFlow = smokeContent.includes('/notifications/history');
recordCheck(6, 'Notification smoke tests exist', hasNotificationFlow, 'GET /notifications/history');

// 7. Ledger smoke tests exist
const hasLedgerFlow =
  smokeContent.includes('/ledger/accounts/') && smokeContent.includes('/entries');
recordCheck(
  7,
  'Ledger smoke tests exist',
  hasLedgerFlow,
  'GET /ledger/accounts/:accountNumber/entries'
);

// 8. Rollback workflow exists
recordCheck(
  8,
  'Rollback workflow exists',
  rollbackExists,
  '.github/workflows/rollback.yml present'
);

// 9. Rollback uses kubectl rollout undo for all six deployments
const services = ['gateway', 'auth', 'account', 'payment', 'ledger', 'notification'];
const rollbackUsesUndo =
  /kubectl\s+rollout\s+undo\s+deployment\//i.test(rollbackContent) &&
  /kubectl\s+rollout\s+undo\s+deployment\//i.test(deployContent) &&
  services.every((s) => new RegExp(`${s}`, 'i').test(rollbackContent));
recordCheck(
  9,
  'Rollback uses kubectl rollout undo for all six deployments',
  rollbackUsesUndo,
  'Rollback undo for all 6 microservice deployments'
);

// 10. Rollback logs and smoke logs upload as artifacts
const hasSmokeUpload =
  /smoke-test-report/i.test(deployContent) && /actions\/upload-artifact@v\d+/i.test(deployContent);
const hasRollbackUpload =
  /rollback-logs/i.test(rollbackContent) && /auto-rollback-logs/i.test(deployContent);
recordCheck(
  10,
  'Rollback logs and smoke logs upload as artifacts',
  hasSmokeUpload && hasRollbackUpload,
  'actions/upload-artifact for smoke & rollback logs'
);

// 11. $GITHUB_STEP_SUMMARY includes smoke results and rollback results
const hasSmokeSummary =
  /\$GITHUB_STEP_SUMMARY/.test(deployContent) && /Smoke Tests Summary/i.test(deployContent);
const hasRollbackSummary =
  (/\$GITHUB_STEP_SUMMARY/.test(rollbackContent) || /\$GITHUB_STEP_SUMMARY/.test(deployContent)) &&
  /Rollback/i.test(deployContent);
recordCheck(
  11,
  '$GITHUB_STEP_SUMMARY includes smoke and rollback results',
  hasSmokeSummary && hasRollbackSummary,
  'Dynamic markdown tables in step summary'
);

console.log('\n======================================================');
const allPassed = checks.every((c) => c.pass);
if (allPassed) {
  console.log(
    `🎉 All ${checks.length}/${checks.length} Smoke Tests & Rollback Pipeline checks PASSED!`
  );
  process.exit(0);
} else {
  const failed = checks.filter((c) => !c.pass);
  console.error(`❌ ${failed.length} checks failed.`);
  process.exit(1);
}
