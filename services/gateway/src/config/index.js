import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.GATEWAY_PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://vaultuser:vaultpass@localhost:5433/vaultcore_db?schema=public',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT || 6379,
  rabbitmqUri:
    process.env.RABBITMQ_URI ||
    `amqp://${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`,
  proxyTimeout: parseInt(process.env.PROXY_TIMEOUT_MS || '10000', 10),
  timeouts: {
    auth: parseInt(process.env.AUTH_SERVICE_TIMEOUT_MS || '3000', 10),
    account: parseInt(process.env.ACCOUNT_SERVICE_TIMEOUT_MS || '5000', 10),
    payment: parseInt(process.env.PAYMENT_SERVICE_TIMEOUT_MS || '8000', 10),
    ledger: parseInt(process.env.LEDGER_SERVICE_TIMEOUT_MS || '8000', 10),
    notification: parseInt(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS || '5000', 10),
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    account: process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3002',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
    ledger: process.env.LEDGER_SERVICE_URL || 'http://localhost:3004',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  },
};
