import Redis from 'ioredis';
import { REDIS_DATABASES } from '../constants/index.js';
import { createLogger } from '../logger/index.js';

const defaultLogger = createLogger('rate-limiter');

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
local member = ARGV[4]

-- 1. Remove expired timestamps outside the sliding window
local clearBefore = nowMs - windowMs
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- 2. Count requests in current window
local currentCount = redis.call('ZCARD', key)

if currentCount < limit then
  -- 3. Add current timestamp
  redis.call('ZADD', key, nowMs, member)
  -- 4. Set TTL on sorted set
  redis.call('EXPIRE', key, math.ceil(windowMs / 1000) + 1)
  local remaining = limit - currentCount - 1
  local resetSeconds = math.ceil((nowMs + windowMs) / 1000)
  return {1, remaining, resetSeconds, 0}
else
  -- Quota exceeded: calculate when the oldest request in the window expires
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTime = tonumber(oldest[2]) or nowMs
  local resetSeconds = math.ceil((oldestTime + windowMs) / 1000)
  local retryAfter = math.max(1, math.ceil((oldestTime + windowMs - nowMs) / 1000))
  return {0, 0, resetSeconds, retryAfter}
end
`;

export class RateLimiterService {
  constructor(options = {}) {
    this.logger = options.logger || defaultLogger;
    this.redisHost = options.redisHost || process.env.REDIS_HOST || 'localhost';
    this.redisPort = options.redisPort || parseInt(process.env.REDIS_PORT || '6379', 10);
    this.db = REDIS_DATABASES.RATE_LIMIT; // Exclusively DB 0

    this.redis =
      options.redis ||
      new Redis({
        host: this.redisHost,
        port: this.redisPort,
        db: this.db,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });

    this.isReady = false;

    // Register custom Lua command
    this.redis.defineCommand('slidingWindowRateLimit', {
      numberOfKeys: 1,
      lua: SLIDING_WINDOW_LUA,
    });

    // In-memory metrics tracker
    this.metrics = {
      allowedRequests: 0,
      blockedRequests: 0,
      totalChecks: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      lastCheckLatencyMs: 0,
    };

    this.init().catch((err) => {
      this.logger.warn(`RateLimiterService initial connection deferred: ${err.message}`);
    });
  }

  async init() {
    if (this.redis.status === 'ready' || this.redis.status === 'connecting') return;
    try {
      await this.redis.connect();
      this.isReady = true;
      this.logger.info(
        `RateLimiterService connected to Redis DB${this.db} at ${this.redisHost}:${this.redisPort}`
      );
    } catch (error) {
      this.isReady = false;
      this.logger.warn(`RateLimiterService connection warning: ${error.message}`);
    }
  }

  /**
   * Check and consume rate limit quota atomically using sliding window Lua script
   *
   * @param {string} key - Rate limit key (e.g., 'rate:user:usr-123' or 'rate:ip:127.0.0.1')
   * @param {number} limit - Maximum requests allowed in window
   * @param {number} windowSeconds - Window size in seconds (default 60s)
   * @returns {Promise<{ allowed: boolean, limit: number, remaining: number, resetTime: number, retryAfter: number, latencyMs: number }>}
   */
  async checkRateLimit(key, limit, windowSeconds = 60) {
    const startTime = Date.now();
    const windowMs = windowSeconds * 1000;
    const nowMs = Date.now();
    const uniqueMember = `${nowMs}-${Math.random().toString(36).substring(2, 8)}`;

    try {
      if (!this.isReady && this.redis.status !== 'ready') {
        await this.init();
      }

      // Execute atomic Lua script on Redis DB0
      const result = await this.redis.slidingWindowRateLimit(
        key,
        windowMs,
        limit,
        nowMs,
        uniqueMember
      );

      const latencyMs = Date.now() - startTime;
      const allowed = Number(result[0]) === 1;
      const remaining = Number(result[1]);
      const resetTime = Number(result[2]);
      const retryAfter = Number(result[3]);

      // Update metrics
      this.metrics.totalChecks += 1;
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.lastCheckLatencyMs = latencyMs;
      this.metrics.avgLatencyMs = parseFloat(
        (this.metrics.totalLatencyMs / this.metrics.totalChecks).toFixed(2)
      );

      if (allowed) {
        this.metrics.allowedRequests += 1;
      } else {
        this.metrics.blockedRequests += 1;
      }

      return {
        allowed,
        limit,
        remaining,
        resetTime,
        retryAfter,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(`Rate limit evaluation error for key [${key}]: ${error.message}`);

      // Fail-open strategy: allow request if Redis encounters transient error
      return {
        allowed: true,
        limit,
        remaining: 1,
        resetTime: Math.ceil((Date.now() + windowMs) / 1000),
        retryAfter: 0,
        latencyMs,
        error: error.message,
      };
    }
  }

  /**
   * Reset rate limit bucket for a key
   */
  async reset(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (err) {
      this.logger.warn(`Could not reset rate limit key ${key}: ${err.message}`);
      return false;
    }
  }

  /**
   * Retrieve rate limiter metrics
   */
  getMetrics() {
    return {
      db: this.db,
      isReady: this.isReady || this.redis.status === 'ready',
      ...this.metrics,
    };
  }

  /**
   * Close Redis connection
   */
  async close() {
    try {
      await this.redis.quit();
    } catch (err) {
      this.logger.warn(`Error closing RateLimiterService Redis connection: ${err.message}`);
    }
  }
}

export const rateLimiterService = new RateLimiterService();
