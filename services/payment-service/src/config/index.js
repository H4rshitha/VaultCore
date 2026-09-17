import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PAYMENT_SERVICE_PORT || 3003,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026',
  ledgerServiceUrl: process.env.LEDGER_SERVICE_URL || 'http://localhost:3004',
  internalApiKey:
    process.env.INTERNAL_SERVICE_API_KEY || 'vaultcore-internal-service-secret-key-2026',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT || 6379,
  rabbitmqHost: process.env.RABBITMQ_HOST || 'localhost',
  rabbitmqPort: process.env.RABBITMQ_PORT || 5672,
};
