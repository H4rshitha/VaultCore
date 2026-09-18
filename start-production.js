/**
 * VaultCore Production All-in-One Service Supervisor
 *
 * Runs inside the Render Free Web Service container.
 * Starts internal Redis, applies database migrations, launches all
 * microservices on isolated localhost ports, and exposes the public API Gateway.
 */

import { spawn, execSync } from 'child_process';

console.log('====================================================');
console.log('   VaultCore — Production Services Supervisor');
console.log('====================================================\n');

// 1. Start internal Redis server daemon
try {
  console.log('📦 Launching Redis daemon on 127.0.0.1:6379...');
  execSync('redis-server --daemonize yes --port 6379 --protected-mode no', { stdio: 'inherit' });
  console.log('✅ Redis daemon active.');
} catch (err) {
  console.log('ℹ️ Internal Redis start skipped (using external or existing instance).');
}

// 2. Apply Prisma Migrations to PostgreSQL
try {
  console.log('\n🔄 Applying Prisma database migrations...');
  execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', { stdio: 'inherit' });
  console.log('✅ Prisma database migrations applied successfully.');
} catch (err) {
  console.error('⚠️ Database migration note:', err.message);
}

// 3. Launch isolated microservices
const services = [
  { name: 'Auth Service', script: 'services/auth-service/src/server.js', port: 3001 },
  { name: 'Account Service', script: 'services/account-service/src/server.js', port: 3002 },
  { name: 'Payment Service', script: 'services/payment-service/src/server.js', port: 3003 },
  { name: 'Ledger Service', script: 'services/ledger-service/src/server.js', port: 3004 },
  {
    name: 'Notification Service',
    script: 'services/notification-service/src/server.js',
    port: 3005,
  },
];

const children = [];

for (const svc of services) {
  console.log(`🚀 Starting ${svc.name} on internal port ${svc.port}...`);
  const child = spawn('node', [svc.script], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(svc.port),
      NODE_ENV: 'production',
      REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
      REDIS_PORT: process.env.REDIS_PORT || '6379',
      LEDGER_SERVICE_URL: process.env.LEDGER_SERVICE_URL || 'http://127.0.0.1:3004',
      JWT_SECRET: process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026',
      INTERNAL_SERVICE_API_KEY:
        process.env.INTERNAL_SERVICE_API_KEY || 'vaultcore-internal-service-secret-key-2026',
    },
  });
  children.push(child);
}

// 4. Give microservices a brief moment to listen before starting Gateway
setTimeout(() => {
  const gatewayPort = process.env.PORT || process.env.GATEWAY_PORT || 3000;
  console.log(`\n🌐 Starting VaultCore Gateway on public port ${gatewayPort}...`);

  const gateway = spawn('node', ['services/gateway/src/server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      GATEWAY_PORT: String(gatewayPort),
      NODE_ENV: 'production',
      AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:3001',
      ACCOUNT_SERVICE_URL: process.env.ACCOUNT_SERVICE_URL || 'http://127.0.0.1:3002',
      PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:3003',
      LEDGER_SERVICE_URL: process.env.LEDGER_SERVICE_URL || 'http://127.0.0.1:3004',
      NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:3005',
      REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
      REDIS_PORT: process.env.REDIS_PORT || '6379',
      JWT_SECRET: process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026',
      INTERNAL_SERVICE_API_KEY:
        process.env.INTERNAL_SERVICE_API_KEY || 'vaultcore-internal-service-secret-key-2026',
    },
  });
  children.push(gateway);
}, 2000);

const shutdown = () => {
  console.log('\n🛑 Shutting down all VaultCore services gracefully...');
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch (_) {}
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
