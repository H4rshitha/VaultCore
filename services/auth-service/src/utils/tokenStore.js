import { createRedisClient, createLogger } from '@vaultcore/shared';
import { config } from '../config/index.js';

const logger = createLogger('auth-token-store');

// Connect to Redis Database 3 for refresh token sessions
const redis = createRedisClient(
  {
    host: config.redisHost,
    port: config.redisPort,
    db: config.redisDb,
  },
  logger
);

export class TokenStore {
  /**
   * Save refresh token session in Redis DB3 with 7-day TTL
   * Key Format: refresh:{userId}:{jti}
   */
  static async saveRefreshToken(userId, jti, tokenValue = 'true') {
    const key = `refresh:${userId}:${jti}`;
    await redis.set(key, tokenValue, 'EX', config.refreshTokenTtlSeconds);
    logger.info('Refresh token session stored in Redis DB3', { userId, jti });
  }

  /**
   * Validate if refresh token session key exists in Redis DB3
   */
  static async isRefreshTokenValid(userId, jti) {
    const key = `refresh:${userId}:${jti}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  /**
   * Delete refresh token session key from Redis DB3 on logout
   */
  static async revokeRefreshToken(userId, jti) {
    const key = `refresh:${userId}:${jti}`;
    await redis.del(key);
    logger.info('Refresh token session revoked from Redis DB3', { userId, jti });
  }
}
