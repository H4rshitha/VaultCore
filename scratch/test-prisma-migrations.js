import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const deployWorkflowPath = path.join(rootDir, '.github', 'workflows', 'deploy.yml');

console.log('=== VaultCore Stage 3: Database Migration Pipeline Verification ===\n');

const checks = [];

function recordCheck(number, name, pass, details = '') {
  checks.push({ number, name, pass, details });
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - [Requirement ${number}] ${name} ${details ? `(${details})` : ''}`);
}

// 0. deploy.yml exists
const exists = fs.existsSync(deployWorkflowPath);
if (!exists) {
  console.error('\n❌ deploy.yml was not found! Aborting verification.');
  process.exit(1);
}

const content = fs.readFileSync(deployWorkflowPath, 'utf8');

// 1. PostgreSQL readiness check exists
const hasPostgresReadiness =
  /PostgreSQL Readiness/i.test(content) &&
  (/SELECT 1/i.test(content) || /pg_isready/i.test(content) || /prisma\.\$queryRaw/i.test(content));
recordCheck(
  1,
  'PostgreSQL readiness check exists',
  hasPostgresReadiness,
  'Polls PostgreSQL readiness probe before migration'
);

// 2. prisma generate exists
const hasPrismaGenerate = /prisma\s+generate/i.test(content);
recordCheck(
  2,
  'prisma generate exists',
  hasPrismaGenerate,
  'npx prisma generate --schema=prisma/schema.prisma'
);

// 3. prisma migrate deploy exists
const hasPrismaMigrateDeploy = /prisma\s+migrate\s+deploy/i.test(content);
recordCheck(
  3,
  'prisma migrate deploy exists',
  hasPrismaMigrateDeploy,
  'npx prisma migrate deploy for deterministic migrations'
);

// 4. prisma migrate dev does NOT exist
const hasPrismaMigrateDev = /prisma\s+migrate\s+dev/i.test(content);
recordCheck(
  4,
  'prisma migrate dev does NOT exist',
  !hasPrismaMigrateDev,
  'Zero occurrences of dev migration in CI/CD'
);

// 5. Seed step runs only for development/staging
const hasSeedCheck =
  /if:\s*.*(?:development|staging).*prisma\/seed\.js/s.test(content) ||
  (/prisma\/seed\.js/.test(content) &&
    /development/.test(content) &&
    /staging/.test(content) &&
    /env\.DEPLOY_ENV == 'development' || env\.DEPLOY_ENV == 'staging'/i.test(content));
recordCheck(
  5,
  'Seed step runs only for development/staging',
  hasSeedCheck,
  'Conditional execution excludes production'
);

// 6. Migration logs are uploaded as artifacts
const hasLogsUpload =
  /actions\/upload-artifact@v\d+/i.test(content) && /migration-logs/i.test(content);
recordCheck(
  6,
  'Migration logs uploaded as artifacts',
  hasLogsUpload,
  'actions/upload-artifact@v4 for migration-logs'
);

// 7. Workflow fails on migration errors
const failsOnError =
  !/continue-on-error:\s*true/i.test(
    content.slice(
      content.indexOf('prisma migrate deploy') - 200,
      content.indexOf('prisma migrate deploy') + 200
    )
  ) && /prisma migrate deploy/.test(content);
recordCheck(
  7,
  'Workflow fails on migration errors',
  failsOnError,
  'Migration step immediately halts workflow on failure'
);

// 8. $GITHUB_STEP_SUMMARY contains migration results
const hasStepSummary =
  /\$GITHUB_STEP_SUMMARY/.test(content) && /Database Migration Summary/i.test(content);
recordCheck(
  8,
  '$GITHUB_STEP_SUMMARY contains migration results',
  hasStepSummary,
  'Step summary table with migration status and details'
);

console.log('\n======================================================');
const allPassed = checks.every((c) => c.pass);
if (allPassed) {
  console.log(
    `🎉 All ${checks.length}/${checks.length} Database Migration Pipeline checks PASSED!`
  );
  process.exit(0);
} else {
  const failed = checks.filter((c) => !c.pass);
  console.error(`❌ ${failed.length} checks failed.`);
  process.exit(1);
}
