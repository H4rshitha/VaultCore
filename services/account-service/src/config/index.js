import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.ACCOUNT_SERVICE_PORT || 3002,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026',
};
