import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.AUTH_SERVICE_PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'super-secret-vaultcore-refresh-key-2026',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT || 6379,
  redisDb: 3, // Database 3 reserved exclusively for Auth Session / Refresh Token Storage
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60, // 7 days in seconds (604800)
};
