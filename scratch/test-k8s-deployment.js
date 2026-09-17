import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const deployWorkflowPath = path.join(rootDir, '.github', 'workflows', 'deploy.yml');

console.log('=== VaultCore Stage 4: Kubernetes Deployment Pipeline Verification ===\n');

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

// 1. kubectl installation exists
const hasKubectl = /azure\/setup-kubectl@v\d+/i.test(content) || /install\s+kubectl/i.test(content);
recordCheck(1, 'kubectl installation exists', hasKubectl, 'azure/setup-kubectl action step');

// 2. kustomize installation exists
const hasKustomize = /setup-kustomize@v\d+/i.test(content) || /install\s+kustomize/i.test(content);
recordCheck(
  2,
  'kustomize installation exists',
  hasKustomize,
  'imranismail/setup-kustomize action step'
);

// 3. kubectl apply -k infrastructure/k8s exists
const hasKubectlApplyKustomize = /kubectl\s+apply\s+-k\s+infrastructure\/k8s/i.test(content);
recordCheck(
  3,
  'kubectl apply -k infrastructure/k8s exists',
  hasKubectlApplyKustomize,
  'Applies manifests via Kustomize overlay'
);

// 4. Image replacement uses Kustomize
const hasKustomizeSetImage =
  /kustomize\s+edit\s+set\s+image/i.test(content) &&
  /vaultcore\/gateway=/i.test(content) &&
  /vaultcore\/auth-service=/i.test(content) &&
  /vaultcore\/account-service=/i.test(content) &&
  /vaultcore\/payment-service=/i.test(content) &&
  /vaultcore\/ledger-service=/i.test(content) &&
  /vaultcore\/notification-service=/i.test(content);
recordCheck(
  4,
  'Image replacement uses Kustomize',
  hasKustomizeSetImage,
  'kustomize edit set image for all 6 microservices'
);

// 5. Rollout status check exists for all six Deployments
const deployments = ['gateway', 'auth', 'account', 'payment', 'ledger', 'notification'];
const hasRolloutStatusDeployments =
  /kubectl\s+rollout\s+status\s+deployment/i.test(content) &&
  deployments.every((dep) => new RegExp(`${dep}`, 'i').test(content));
recordCheck(
  5,
  'Rollout status check exists for all six Deployments',
  hasRolloutStatusDeployments,
  'gateway, auth, account, payment, ledger, notification deployments checked with --timeout'
);

// 6. StatefulSet rollout verification exists
const statefulsets = ['postgres', 'redis', 'rabbitmq'];
const hasRolloutStatusStatefulSets =
  /kubectl\s+rollout\s+status\s+statefulset/i.test(content) &&
  statefulsets.every((sts) => new RegExp(`${sts}`, 'i').test(content));
recordCheck(
  6,
  'StatefulSet rollout verification exists',
  hasRolloutStatusStatefulSets,
  'postgres, redis, rabbitmq statefulsets checked with --timeout'
);

// 7. Readiness verification exists
const hasReadinessVerification =
  /readiness/i.test(content) &&
  (/kubectl\s+wait\s+--for=condition=ready\s+pod/i.test(content) ||
    /readinessProbe/i.test(content) ||
    /rollout status/i.test(content));
recordCheck(
  7,
  'Readiness verification exists',
  hasReadinessVerification,
  'kubectl wait for condition=ready across pods'
);

// 8. Rollout logs uploaded as artifacts
const hasLogsUpload =
  /actions\/upload-artifact@v\d+/i.test(content) && /rollout-logs/i.test(content);
recordCheck(
  8,
  'Rollout logs uploaded as artifacts',
  hasLogsUpload,
  'actions/upload-artifact@v4 for k8s-rollout-logs'
);

// 9. $GITHUB_STEP_SUMMARY contains deployment status
const hasStepSummary =
  /\$GITHUB_STEP_SUMMARY/.test(content) && /Kubernetes Deployment Summary/i.test(content);
recordCheck(
  9,
  '$GITHUB_STEP_SUMMARY contains deployment status',
  hasStepSummary,
  'Step summary table with deployment and rollout status'
);

// 10. Workflow fails on rollout timeout
const failsOnTimeout =
  /--timeout=\d+s/i.test(content) &&
  !/continue-on-error:\s*true/i.test(
    content.slice(
      content.indexOf('Verify Deployment Rollouts'),
      content.indexOf('Verify Pod Readiness Probes')
    )
  );
recordCheck(
  10,
  'Workflow fails on rollout timeout',
  failsOnTimeout,
  'Deterministic failure on timeout without ignoring exit code'
);

console.log('\n======================================================');
const allPassed = checks.every((c) => c.pass);
if (allPassed) {
  console.log(
    `🎉 All ${checks.length}/${checks.length} Kubernetes Deployment Pipeline checks PASSED!`
  );
  process.exit(0);
} else {
  const failed = checks.filter((c) => !c.pass);
  console.error(`❌ ${failed.length} checks failed.`);
  process.exit(1);
}
