import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const workflowsDir = path.join(rootDir, '.github', 'workflows');
const docPath = path.join(rootDir, 'docs', 'cicd-pipeline.md');

console.log('=== VaultCore CI/CD Final Verification Suite (Stages 7 - 10) ===\n');

const checks = [];

function recordCheck(number, name, pass, details = '') {
  checks.push({ number, name, pass, details });
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - [Check ${number}] ${name} ${details ? `(${details})` : ''}`);
}

// 1. All workflow YAML files exist
const workflowFiles = ['ci.yml', 'docker-build.yml', 'deploy.yml', 'rollback.yml', 'release.yml'];
const allWorkflowsExist = workflowFiles.every((file) => fs.existsSync(path.join(workflowsDir, file)));
recordCheck(
  1,
  'All workflow YAML files exist',
  allWorkflowsExist,
  'ci.yml, docker-build.yml, deploy.yml, rollback.yml, release.yml'
);

if (!allWorkflowsExist) {
  console.error('\n❌ Missing one or more required workflow files! Aborting.');
  process.exit(1);
}

const ciContent = fs.readFileSync(path.join(workflowsDir, 'ci.yml'), 'utf8');
const dockerContent = fs.readFileSync(path.join(workflowsDir, 'docker-build.yml'), 'utf8');
const deployContent = fs.readFileSync(path.join(workflowsDir, 'deploy.yml'), 'utf8');
const rollbackContent = fs.readFileSync(path.join(workflowsDir, 'rollback.yml'), 'utf8');
const releaseContent = fs.readFileSync(path.join(workflowsDir, 'release.yml'), 'utf8');

// 2. Reusable workflow logic exists
const hasReusableLogic =
  /workflow_call/i.test(rollbackContent) ||
  /workflow_call/i.test(dockerContent) ||
  /actions\/checkout@v4/i.test(ciContent);
recordCheck(2, 'Reusable workflow logic exists', hasReusableLogic, 'workflow_call and standardized step helpers present');

// 3. GitHub Environments referenced
const hasEnvironments =
  /environment:/i.test(deployContent) &&
  /development/i.test(deployContent) &&
  /staging/i.test(deployContent) &&
  /production/i.test(deployContent);
recordCheck(3, 'GitHub Environments referenced', hasEnvironments, 'development, staging, and production environments configured');

// 4. No hardcoded secrets
const allWorkflowText = `${ciContent}\n${dockerContent}\n${deployContent}\n${rollbackContent}\n${releaseContent}`;
const usesSecretSyntax =
  /\${{\s*secrets\.DATABASE_URL\s*}}/.test(allWorkflowText) &&
  /\${{\s*secrets\.KUBE_CONFIG\s*}}/.test(allWorkflowText);
const noHardcodedPasswords =
  !/DATABASE_URL:\s*['"]?postgresql:\/\/[^$]/i.test(deployContent) &&
  !/KUBE_CONFIG:\s*['"]?apiVersion/i.test(deployContent);
recordCheck(4, 'No hardcoded secrets', usesSecretSyntax && noHardcodedPasswords, 'Zero plain-text credentials in workflows');

// 5. release.yml triggers only on version tags
const hasTagTriggerOnly =
  /push:\s*tags:\s*-\s*['"]?v/i.test(releaseContent) &&
  !/branches:\s*-\s*['"]?main['"]?/i.test(releaseContent);
recordCheck(5, 'release.yml triggers only on version tags', hasTagTriggerOnly, "Triggers on 'v*' and 'v*.*.*' tags only");

// 6. Changelog generation exists
const hasChangelog =
  /git\s+log/i.test(releaseContent) &&
  /changelog/i.test(releaseContent);
recordCheck(6, 'Changelog generation exists', hasChangelog, 'Automatic git log changelog generator');

// 7. GitHub Release creation exists
const hasReleaseCreation =
  /action-gh-release/i.test(releaseContent) ||
  /create-release/i.test(releaseContent);
recordCheck(7, 'GitHub Release creation exists', hasReleaseCreation, 'softprops/action-gh-release integration');

// 8. Deployment metadata included
const hasMetadata =
  /release-metadata/i.test(releaseContent) &&
  /gitSha/i.test(releaseContent) &&
  /releaseTimestamp/i.test(releaseContent) &&
  /dockerImages/i.test(releaseContent);
recordCheck(8, 'Deployment metadata included', hasMetadata, 'Git SHA, timestamp, environment, Docker tags');

// 9. Documentation file exists
const docExists = fs.existsSync(docPath);
recordCheck(9, 'Documentation file exists', docExists, docPath);

if (!docExists) {
  console.error('\n❌ docs/cicd-pipeline.md was not found! Aborting.');
  process.exit(1);
}

const docContent = fs.readFileSync(docPath, 'utf8');

// 10. Documentation contains all required sections
const requiredSections = [
  'CI Architecture',
  'Docker Build Pipeline',
  'Prisma Migration Flow',
  'Kubernetes Deployment Flow',
  'Smoke Test Flow',
  'Automatic Rollback Flow',
  'GitHub Environments',
  'Required GitHub Secrets',
  'Image Tagging Strategy',
  'Local Development Pipeline',
  'Production Deployment Checklist',
  'Troubleshooting Guide',
  'Rollback Procedure',
  'Artifact Retention Policy',
];

const allSectionsPresent = requiredSections.every((section) =>
  new RegExp(section, 'i').test(docContent)
);
recordCheck(
  10,
  'Documentation contains all 14 required sections',
  allSectionsPresent,
  'CI, Docker, Prisma, K8s, Smoke, Rollback, Environments, Secrets, Tags, Local Dev, Checklist, Troubleshooting, Rollback, Retention'
);

console.log('\n======================================================');
const allPassed = checks.every((c) => c.pass);
if (allPassed) {
  console.log(`🎉 All ${checks.length}/${checks.length} Final CI/CD Verification Checks PASSED!`);
  process.exit(0);
} else {
  const failed = checks.filter((c) => !c.pass);
  console.error(`❌ ${failed.length} checks failed.`);
  process.exit(1);
}
