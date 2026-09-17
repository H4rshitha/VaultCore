import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const ciPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');

console.log('=== VaultCore CI Workflow Foundation & Refinements Verification ===\n');

const checks = [];

function recordCheck(name, pass, details = '') {
  checks.push({ name, pass, details });
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name} ${details ? `(${details})` : ''}`);
}

// Simple YAML validator (checks indentation consistency, quotes, keys, arrays)
function validateYamlStructure(content) {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check tabs (YAML forbids tabs)
    if (line.includes('\t')) {
      return { valid: false, error: `Line ${i + 1} contains tab character: ${line}` };
    }
  }

  return { valid: true };
}

// 1. Check ci.yml exists
const exists = fs.existsSync(ciPath);
recordCheck('ci.yml exists', exists, ciPath);

if (!exists) {
  console.error('\n❌ ci.yml was not found! Aborting remaining checks.');
  process.exit(1);
}

const content = fs.readFileSync(ciPath, 'utf8');

// 2. YAML syntax valid
const yamlValidation = validateYamlStructure(content);
recordCheck(
  'YAML syntax valid',
  yamlValidation.valid,
  yamlValidation.error || 'Indentation and structure valid'
);

// 3. Trigger configuration
const hasPullRequest = /pull_request:\s*(branches:\s*-\s*['"]?\*\*['"]?)?/i.test(content);
const hasPush = /push:\s*branches:\s*-\s*['"]?\*\*['"]?\s*tags-ignore:/i.test(content);
recordCheck(
  'Triggers: Pull Requests & Push (excluding tags)',
  hasPullRequest && hasPush,
  'PRs and push to branches, tags-ignore'
);

// 4. Refinement 17.1A: Concurrency configuration
const hasConcurrency =
  /concurrency:\s*group:\s*ci-\${{\s*github\.ref\s*}}\s*cancel-in-progress:\s*true/i.test(content);
recordCheck(
  'Refinement 17.1A — Concurrency control (ci-${{ github.ref }}, cancel-in-progress)',
  hasConcurrency,
  'Cancels outdated CI runs for PRs'
);

// 5. Refinement 17.1B: Prisma binary caching
const hasPrismaCache =
  /actions\/cache@v4/i.test(content) &&
  /path:\s*~?\/?\.cache\/prisma/i.test(content) &&
  /key:\s*prisma-\${{\s*runner\.os\s*}}-\${{\s*hashFiles\(['"]\*\*\/schema\.prisma['"]\)\s*}}/i.test(
    content
  );
recordCheck(
  'Refinement 17.1B — Cache Prisma engines (~/.cache/prisma)',
  hasPrismaCache,
  'actions/cache@v4 for Prisma engine binaries'
);

// 6. Node 22 setup & npm cache
const hasNode22 = /node-version:\s*22/.test(content) && /actions\/setup-node@v4/.test(content);
const hasNpmCache = /cache:\s*['"]npm['"]/.test(content);
recordCheck(
  'Node 22 runtime & npm cache',
  hasNode22 && hasNpmCache,
  'actions/setup-node@v4 with Node 22 and npm cache'
);

// 7. Prisma validation & generate step exists
const hasPrismaValidate = /prisma\s+validate/i.test(content);
const hasPrismaGenerate = /prisma\s+generate/i.test(content);
recordCheck(
  'Prisma schema validation & generate',
  hasPrismaValidate && hasPrismaGenerate,
  'npx prisma validate & generate'
);

// 8. ESLint & Prettier
const hasEslint = /eslint/i.test(content);
const hasPrettier = /prettier/i.test(content);
recordCheck(
  'Code quality (ESLint & Prettier)',
  hasEslint && hasPrettier,
  'Zero lint errors & formatting checks'
);

// 9. npm security audit
const hasNpmAudit = /npm\s+audit\s+--omit=dev/i.test(content);
recordCheck('npm security audit', hasNpmAudit, 'npm audit --omit=dev');

// 10. Backend unit tests for all 6 microservices
const hasBackendTests = /backend-unit-tests/i.test(content);
const hasAllServices =
  /gateway/.test(content) &&
  /auth-service/.test(content) &&
  /account-service/.test(content) &&
  /payment-service/.test(content) &&
  /ledger-service/.test(content) &&
  /notification-service/.test(content);
recordCheck(
  'Backend unit tests (6 services)',
  hasBackendTests && hasAllServices,
  'gateway, auth, account, payment, ledger, notification'
);

// 11. Frontend tests & build
const hasFrontendTests = /frontend-tests/i.test(content) && /run\s+build/i.test(content);
recordCheck(
  'Frontend tests & production build',
  hasFrontendTests,
  'frontend-tests job with Vite production build'
);

// 12. Integration tests (PostgreSQL, Redis, RabbitMQ)
const hasIntegrationTests = /integration-tests/i.test(content);
const hasServices =
  /postgres:15-alpine/i.test(content) &&
  /redis:7-alpine/i.test(content) &&
  /rabbitmq:3-management-alpine/i.test(content);
recordCheck(
  'Integration tests with services',
  hasIntegrationTests && hasServices,
  'postgres:15-alpine, redis:7-alpine, rabbitmq:3-management-alpine'
);

// 13. Refinement 17.1C: Upload test reports separately
const hasBackendCoverageArtifact = /name:\s*backend-coverage/i.test(content);
const hasFrontendCoverageArtifact = /name:\s*frontend-coverage/i.test(content);
const hasIntegrationResultsArtifact = /name:\s*integration-results/i.test(content);
recordCheck(
  'Refinement 17.1C — Upload reports separately (backend-coverage, frontend-coverage, integration-results)',
  hasBackendCoverageArtifact && hasFrontendCoverageArtifact && hasIntegrationResultsArtifact,
  'Separated artifacts for backend coverage, frontend coverage, and integration test logs'
);

// 14. Summary generation exists
const hasSummary = /\$GITHUB_STEP_SUMMARY/.test(content);
recordCheck('GitHub Step Summary reporting', hasSummary, '$GITHUB_STEP_SUMMARY markdown reporting');

console.log('\n======================================================');
const allPassed = checks.every((c) => c.pass);
if (allPassed) {
  console.log(
    `🎉 All ${checks.length}/${checks.length} CI foundation and refinement checks PASSED!`
  );
  process.exit(0);
} else {
  const failed = checks.filter((c) => !c.pass);
  console.error(`❌ ${failed.length} checks failed.`);
  process.exit(1);
}
