import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.LEDGER_SERVICE_PORT || 3004,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026',
  internalApiKey:
    process.env.INTERNAL_SERVICE_API_KEY || 'vaultcore-internal-service-secret-key-2026',
  rabbitmqHost: process.env.RABBITMQ_HOST || 'localhost',
  rabbitmqPort: process.env.RABBITMQ_PORT || 5672,
};
