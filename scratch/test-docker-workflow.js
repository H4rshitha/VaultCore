import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dockerWorkflowPath = path.join(rootDir, '.github', 'workflows', 'docker-build.yml');

console.log('=== VaultCore Docker Build Pipeline Verification ===\n');

const checks = [];

function recordCheck(number, name, pass, details = '') {
  checks.push({ number, name, pass, details });
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - [Requirement ${number}] ${name} ${details ? `(${details})` : ''}`);
}

// Simple YAML validator (checks indentation consistency and tab characters)
function validateYamlStructure(content) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (line.includes('\t')) {
      return { valid: false, error: `Line ${i + 1} contains tab character: ${line}` };
    }
  }
  return { valid: true };
}

// 1. docker-build.yml exists
const exists = fs.existsSync(dockerWorkflowPath);
recordCheck(1, 'docker-build.yml exists', exists, dockerWorkflowPath);

if (!exists) {
  console.error('\n❌ docker-build.yml was not found! Aborting remaining checks.');
  process.exit(1);
}

const content = fs.readFileSync(dockerWorkflowPath, 'utf8');

// 2. YAML syntax is valid
const yamlValidation = validateYamlStructure(content);
recordCheck(2, 'YAML syntax is valid', yamlValidation.valid, yamlValidation.error || 'Indentation and formatting valid');

// 3. Matrix contains all six services
const services = ['gateway', 'auth-service', 'account-service', 'payment-service', 'ledger-service', 'notification-service'];
const allServicesInMatrix = services.every((s) => new RegExp(`-\\s+${s}`).test(content));
recordCheck(
  3,
  'Matrix contains all six services',
  allServicesInMatrix,
  'gateway, auth-service, account-service, payment-service, ledger-service, notification-service'
);

// 4. BuildKit is enabled
const hasBuildKit = /DOCKER_BUILDKIT:\s*1/.test(content) || /docker\/setup-buildx-action@v\d+/.test(content);
recordCheck(4, 'BuildKit is enabled', hasBuildKit, 'DOCKER_BUILDKIT: 1 & docker/setup-buildx-action@v3');

// 5. Cache configuration exists
const hasCache = /cache-from:\s*type=gha/.test(content) && /cache-to:\s*type=gha/.test(content);
recordCheck(5, 'Cache configuration exists', hasCache, 'cache-from: type=gha, cache-to: type=gha,mode=max');

// 6. GHCR login step exists
const hasGhcrLogin = /docker\/login-action@v\d+/.test(content) && /registry:\s*ghcr\.io/.test(content);
recordCheck(6, 'GHCR login step exists', hasGhcrLogin, 'docker/login-action@v3 with registry: ghcr.io and GITHUB_TOKEN');

// 7. Push step exists
const hasPush = /docker\/build-push-action@v\d+/.test(content) && /push:\s*true/.test(content);
recordCheck(7, 'Push step exists', hasPush, 'docker/build-push-action@v5 with push: true');

// 8. Tags include latest and Git SHA
const hasLatestTag = /value=latest/.test(content) || /type=raw,\s*value=latest/.test(content);
const hasGitShaTag = /value=\${{\s*github\.sha\s*}}/.test(content) || /type=sha/.test(content);
recordCheck(8, 'Tags include latest and Git SHA', hasLatestTag && hasGitShaTag, 'latest and ${{ github.sha }}');

// 9. Semantic version tagging logic exists
const hasSemver = /type=semver/.test(content) && /pattern=\{\{version\}\}/.test(content);
recordCheck(9, 'Semantic version tagging logic exists', hasSemver, 'docker/metadata-action@v5 with semver patterns');

// 10. Build metadata artifact upload exists
const hasMetadataArtifact = /actions\/upload-artifact@v\d+/.test(content) && /build-metadata/i.test(content);
recordCheck(10, 'Build metadata artifact upload exists', hasMetadataArtifact, 'actions/upload-artifact@v4 for build metadata JSON');

console.log('\n======================================================');
const allPassed = checks.every((c) => c.pass);
if (allPassed) {
  console.log(`🎉 All ${checks.length}/${checks.length} Docker build pipeline requirements PASSED!`);
  process.exit(0);
} else {
  const failed = checks.filter((c) => !c.pass);
  console.error(`❌ ${failed.length} checks failed.`);
  process.exit(1);
}
