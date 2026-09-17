import Redis from 'ioredis';

export const createRedisClient = (config = {}, logger) => {
  const host = config.host || process.env.REDIS_HOST || 'localhost';
  const port = config.port || process.env.REDIS_PORT || 6379;
  const password = config.password || process.env.REDIS_PASSWORD || undefined;
  const db = config.db !== undefined ? config.db : (process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0);

  const redis = new Redis({
    host,
    port,
    password,
    db,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  });

  redis.on('connect', () => {
    if (logger) logger.info(`Connected to Redis at ${host}:${port} (DB ${db})`);
  });

  redis.on('error', (err) => {
    if (logger) logger.error(`Redis client error (DB ${db}): ${err.message}`);
  });

  return redis;
};
