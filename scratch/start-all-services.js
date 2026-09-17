import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const services = [
  { name: 'Auth Service', path: 'services/auth-service/src/server.js' },
  { name: 'Account Service', path: 'services/account-service/src/server.js' },
  { name: 'Payment Service', path: 'services/payment-service/src/server.js' },
  { name: 'Ledger Service', path: 'services/ledger-service/src/server.js' },
  { name: 'Notification Service', path: 'services/notification-service/src/server.js' },
  { name: 'API Gateway', path: 'services/gateway/src/server.js' },
];

console.log('=== Starting VaultCore Local Microservices Cluster ===\n');

let isShuttingDown = false;
const processMap = new Map();

function startService(svc) {
  if (isShuttingDown) return;

  const scriptPath = path.join(rootDir, svc.path);
  const child = fork(scriptPath, [], {
    cwd: rootDir,
    env: { ...process.env },
    stdio: 'inherit',
  });

  processMap.set(svc.name, child);

  child.on('exit', (code, signal) => {
    processMap.delete(svc.name);
    if (!isShuttingDown) {
      console.warn(
        `[Cluster Supervisor] ${svc.name} exited (code: ${code}, signal: ${signal}). Auto-restarting in 1s...`
      );
      setTimeout(() => startService(svc), 1000);
    }
  });
}

for (const svc of services) {
  startService(svc);
}

const cleanup = () => {
  isShuttingDown = true;
  console.log('\nShutting down all services...');
  for (const [name, child] of processMap.entries()) {
    try {
      child.kill('SIGINT');
    } catch {
      // ignore
    }
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
