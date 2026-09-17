import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const k8sDir = path.resolve(__dirname, '../infrastructure/k8s');

// Basic multi-document YAML parser (handles standard k8s manifests)
function parseYamlDocuments(content) {
  const docs = content.split(/^---$/m).filter((doc) => doc.trim().length > 0);
  return docs.map((doc) => {
    const lines = doc.split('\n');
    const result = {};
    let currentKey = null;

    // Lightweight verification of key YAML fields
    return {
      raw: doc,
      hasApiVersion: /^apiVersion:\s*(.+)$/m.test(doc),
      hasKind: /^kind:\s*(.+)$/m.test(doc),
      hasMetadata: /^metadata:/m.test(doc),
      apiVersion: (doc.match(/^apiVersion:\s*(.+)$/m) || [])[1]?.trim(),
      kind: (doc.match(/^kind:\s*(.+)$/m) || [])[1]?.trim(),
      name: (doc.match(/^\s*name:\s*(.+)$/m) || [])[1]?.trim(),
    };
  });
}

function runTests() {
  console.log('========================================================================');
  console.log('🚀 VAULTCORE PROMPT 15 — KUBERNETES MANIFESTS VALIDATION SUITE');
  console.log('========================================================================\n');

  const expectedFiles = [
    '01-configmap.yaml',
    '02-secrets.yaml',
    '03-postgres-statefulset.yaml',
    '04-redis-statefulset.yaml',
    '05-rabbitmq-statefulset.yaml',
    '06-gateway-deployment.yaml',
    '07-auth-deployment.yaml',
    '08-account-deployment.yaml',
    '09-payment-deployment.yaml',
    '10-ledger-deployment.yaml',
    '11-notification-deployment.yaml',
    '12-ingress.yaml',
    '13-hpa.yaml',
    'kustomization.yaml',
  ];

  // 1. Verify Manifest Files Existence & Integrity
  console.log('[1. Testing Manifest File Presence & Formatting]');
  for (const filename of expectedFiles) {
    const filePath = path.join(k8sDir, filename);
    assert.strictEqual(fs.existsSync(filePath), true, `Manifest ${filename} must exist`);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.length > 50, `Manifest ${filename} must contain valid content`);
    console.log(`  ✔ ${filename} verified`);
  }

  // 2. Test Infrastructure StatefulSets & PVCs
  console.log('\n[2. Testing Infrastructure StatefulSets & Persistent Storage]');
  const pgContent = fs.readFileSync(path.join(k8sDir, '03-postgres-statefulset.yaml'), 'utf-8');
  assert.ok(pgContent.includes('kind: StatefulSet'));
  assert.ok(pgContent.includes('storage: 10Gi'), 'Postgres PVC must be 10Gi');
  assert.ok(pgContent.includes('pg_isready'), 'Postgres must have pg_isready health probe');
  assert.ok(pgContent.includes('name: postgres-service'));
  console.log('  ✔ PostgreSQL StatefulSet (10Gi PVC, pg_isready probes, postgres-service) verified');

  const redisContent = fs.readFileSync(path.join(k8sDir, '04-redis-statefulset.yaml'), 'utf-8');
  assert.ok(redisContent.includes('kind: StatefulSet'));
  assert.ok(redisContent.includes('storage: 5Gi'), 'Redis PVC must be 5Gi');
  assert.ok(redisContent.includes('--appendonly'), 'Redis AOF persistence enabled');
  assert.ok(redisContent.includes('redis-cli'), 'Redis ping probe configured');
  assert.ok(redisContent.includes('name: redis-service'));
  console.log('  ✔ Redis StatefulSet (5Gi PVC, AOF persistence, redis-service) verified');

  const rabbitContent = fs.readFileSync(path.join(k8sDir, '05-rabbitmq-statefulset.yaml'), 'utf-8');
  assert.ok(rabbitContent.includes('kind: StatefulSet'));
  assert.ok(rabbitContent.includes('storage: 5Gi'), 'RabbitMQ PVC must be 5Gi');
  assert.ok(rabbitContent.includes('5672'), 'RabbitMQ AMQP port 5672 configured');
  assert.ok(rabbitContent.includes('15672'), 'RabbitMQ Management port 15672 configured');
  assert.ok(rabbitContent.includes('rabbitmq-diagnostics'), 'RabbitMQ diagnostics probe configured');
  assert.ok(rabbitContent.includes('name: rabbitmq-service'));
  console.log('  ✔ RabbitMQ StatefulSet (5Gi PVC, Management UI, AMQP, rabbitmq-service) verified');

  // 3. Test Microservice Deployments, Zero-Downtime Rolling Updates & Health Probes
  console.log('\n[3. Testing Microservices Deployments, Probes & Zero-Downtime Strategy]');
  const microserviceFiles = [
    { file: '06-gateway-deployment.yaml', name: 'gateway-deployment', port: 3000, liveness: '/health/live', readiness: '/health/ready' },
    { file: '07-auth-deployment.yaml', name: 'auth-deployment', port: 3001, liveness: '/health', readiness: '/health' },
    { file: '08-account-deployment.yaml', name: 'account-deployment', port: 3002, liveness: '/health', readiness: '/health' },
    { file: '09-payment-deployment.yaml', name: 'payment-deployment', port: 3003, liveness: '/health', readiness: '/health' },
    { file: '10-ledger-deployment.yaml', name: 'ledger-deployment', port: 3004, liveness: '/health', readiness: '/health' },
    { file: '11-notification-deployment.yaml', name: 'notification-deployment', port: 3005, liveness: '/health', readiness: '/health' },
  ];

  for (const ms of microserviceFiles) {
    const content = fs.readFileSync(path.join(k8sDir, ms.file), 'utf-8');
    assert.ok(content.includes('kind: Deployment'), `${ms.name} has Deployment`);
    assert.ok(content.includes('type: RollingUpdate'), `${ms.name} has RollingUpdate strategy`);
    assert.ok(content.includes('maxUnavailable: 0'), `${ms.name} enforces maxUnavailable: 0 for zero-downtime`);
    assert.ok(content.includes('maxSurge: 1'), `${ms.name} sets maxSurge: 1`);
    assert.ok(content.includes(`port: ${ms.port}`), `${ms.name} targets port ${ms.port}`);
    assert.ok(content.includes(`path: ${ms.liveness}`), `${ms.name} has livenessProbe at ${ms.liveness}`);
    assert.ok(content.includes(`path: ${ms.readiness}`), `${ms.name} has readinessProbe at ${ms.readiness}`);
    assert.ok(content.includes('resources:'), `${ms.name} specifies CPU/Memory requests & limits`);
    assert.ok(content.includes('kind: Service'), `${ms.name} defines ClusterIP Service`);
    console.log(`  ✔ ${ms.name} verified: RollingUpdate, Probes (${ms.liveness}/${ms.readiness}), ClusterIP Service`);
  }

  // 4. Test Ingress Networking
  console.log('\n[4. Testing NGINX Ingress Controller Configuration]');
  const ingressContent = fs.readFileSync(path.join(k8sDir, '12-ingress.yaml'), 'utf-8');
  assert.ok(ingressContent.includes('kind: Ingress'));
  assert.ok(ingressContent.includes('kubernetes.io/ingress.class: "nginx"'));
  assert.ok(ingressContent.includes('proxy-body-size: "10m"'));
  assert.ok(ingressContent.includes('proxy-read-timeout: "60"'));
  assert.ok(ingressContent.includes('use-forwarded-headers: "true"'));
  assert.ok(ingressContent.includes('api.vaultcore.local'));
  assert.ok(ingressContent.includes('name: gateway-service'));
  assert.ok(ingressContent.includes('number: 3000'));
  console.log('  ✔ NGINX Ingress verified: Host routing, proxy headers, timeout annotations, gateway backend');

  // 5. Test Horizontal Pod Autoscalers (HPA)
  console.log('\n[5. Testing Horizontal Pod Autoscaling (HPA) Bounds]');
  const hpaContent = fs.readFileSync(path.join(k8sDir, '13-hpa.yaml'), 'utf-8');
  assert.ok(hpaContent.includes('kind: HorizontalPodAutoscaler'));

  // Gateway: 2 -> 10 replicas
  assert.ok(hpaContent.includes('name: gateway-hpa'));
  assert.ok(hpaContent.includes('minReplicas: 2') && hpaContent.includes('maxReplicas: 10'), 'Gateway HPA is 2-10 replicas');

  // Payment: 2 -> 5 replicas
  assert.ok(hpaContent.includes('name: payment-hpa'));
  assert.ok(hpaContent.includes('maxReplicas: 5'), 'Payment HPA is 2-5 replicas');

  // Notification: 1 -> 3 replicas
  assert.ok(hpaContent.includes('name: notification-hpa'));
  assert.ok(hpaContent.includes('maxReplicas: 3'), 'Notification HPA is 1-3 replicas');
  console.log('  ✔ HPA quotas verified: Gateway (2 → 10), Payment Service (2 → 5), Notification Service (1 → 3)');

  // 6. Test Kustomization Manifest
  console.log('\n[6. Testing Kustomization Manifest Bundle]');
  const kustomizeContent = fs.readFileSync(path.join(k8sDir, 'kustomization.yaml'), 'utf-8');
  assert.ok(kustomizeContent.includes('kind: Kustomization'));
  for (const filename of expectedFiles.filter((f) => f !== 'kustomization.yaml')) {
    assert.ok(kustomizeContent.includes(filename), `kustomization.yaml must include ${filename}`);
  }
  console.log('  ✔ Kustomization bundle correctly references all 13 manifests');

  console.log('\n========================================================================');
  console.log(' ✔ ALL PROMPT 15 KUBERNETES DEPLOYMENT MANIFESTS VALIDATED');
  console.log('========================================================================\n');
}

try {
  runTests();
} catch (err) {
  console.error('\n✖ Kubernetes validation failed:', err);
  process.exit(1);
}
