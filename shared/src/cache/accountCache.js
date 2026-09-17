import { createRedisClient } from './redis.js';
import { REDIS_DATABASES, CACHE_TTL } from '../constants/index.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('account-cache');

export class AccountCacheService {
  constructor(options = {}) {
    this.redis = options.redis || createRedisClient({
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || (process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379),
      password: options.password || process.env.REDIS_PASSWORD || undefined,
      db: options.db !== undefined ? options.db : REDIS_DATABASES.ACCOUNT_CACHE,
    }, logger);

    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      sets: 0,
      writeLatencyTotalMs: 0,
    };
  }

  getBalanceKey(accountNumber) {
    return `account:balance:${accountNumber}`;
  }

  getDetailsKey(accountNumber) {
    return `account:details:${accountNumber}`;
  }

  /**
   * Fetch cached account balance (TTL 30s)
   */
  async getBalance(accountNumber, traceId) {
    const key = this.getBalanceKey(accountNumber);
    const start = Date.now();

    try {
      const data = await this.redis.get(key);
      const durationMs = Date.now() - start;

      if (data) {
        this.metrics.hits++;
        logger.info('Cache HIT: account balance retrieved from Redis DB1', {
          key,
          accountNumber,
          traceId,
          durationMs,
        });
        return JSON.parse(data);
      }

      this.metrics.misses++;
      logger.info('Cache MISS: account balance not in Redis DB1', {
        key,
        accountNumber,
        traceId,
        durationMs,
      });
      return null;
    } catch (error) {
      logger.warn('Cache error on getBalance, falling back to database', {
        key,
        accountNumber,
        error: error.message,
        traceId,
      });
      return null;
    }
  }

  /**
   * Cache account balance with 30s TTL
   */
  async setBalance(accountNumber, balanceData, traceId, ttl = CACHE_TTL.ACCOUNT_BALANCE) {
    const key = this.getBalanceKey(accountNumber);
    const start = Date.now();

    try {
      await this.redis.set(key, JSON.stringify(balanceData), 'EX', ttl);
      const durationMs = Date.now() - start;

      this.metrics.sets++;
      this.metrics.writeLatencyTotalMs += durationMs;

      logger.info('Cache SET: account balance stored in Redis DB1', {
        key,
        accountNumber,
        ttl,
        traceId,
        durationMs,
      });
    } catch (error) {
      logger.warn('Cache error on setBalance', {
        key,
        accountNumber,
        error: error.message,
        traceId,
      });
    }
  }

  /**
   * Fetch cached account details (TTL 5m)
   */
  async getDetails(accountNumber, traceId) {
    const key = this.getDetailsKey(accountNumber);
    const start = Date.now();

    try {
      const data = await this.redis.get(key);
      const durationMs = Date.now() - start;

      if (data) {
        this.metrics.hits++;
        logger.info('Cache HIT: account details retrieved from Redis DB1', {
          key,
          accountNumber,
          traceId,
          durationMs,
        });
        return JSON.parse(data);
      }

      this.metrics.misses++;
      logger.info('Cache MISS: account details not in Redis DB1', {
        key,
        accountNumber,
        traceId,
        durationMs,
      });
      return null;
    } catch (error) {
      logger.warn('Cache error on getDetails, falling back to database', {
        key,
        accountNumber,
        error: error.message,
        traceId,
      });
      return null;
    }
  }

  /**
   * Cache account details with 5m TTL
   */
  async setDetails(accountNumber, accountData, traceId, ttl = CACHE_TTL.ACCOUNT_DETAILS) {
    const key = this.getDetailsKey(accountNumber);
    const start = Date.now();

    try {
      await this.redis.set(key, JSON.stringify(accountData), 'EX', ttl);
      const durationMs = Date.now() - start;

      this.metrics.sets++;
      this.metrics.writeLatencyTotalMs += durationMs;

      logger.info('Cache SET: account details stored in Redis DB1', {
        key,
        accountNumber,
        ttl,
        traceId,
        durationMs,
      });
    } catch (error) {
      logger.warn('Cache error on setDetails', {
        key,
        accountNumber,
        error: error.message,
        traceId,
      });
    }
  }

  /**
   * Invalidate both balance and details cache entries for an account
   */
  async invalidateAccount(accountNumber, traceId) {
    const balanceKey = this.getBalanceKey(accountNumber);
    const detailsKey = this.getDetailsKey(accountNumber);
    const start = Date.now();

    try {
      const deletedCount = await this.redis.del(balanceKey, detailsKey);
      const durationMs = Date.now() - start;

      this.metrics.invalidations += deletedCount;

      logger.info('Cache INVALIDATE: account balance and details deleted from Redis DB1', {
        accountNumber,
        keys: [balanceKey, detailsKey],
        deletedCount,
        traceId,
        durationMs,
      });
    } catch (error) {
      logger.warn('Cache error on invalidateAccount', {
        accountNumber,
        error: error.message,
        traceId,
      });
    }
  }

  /**
   * Invalidate cache entries for multiple accounts (e.g. sender and receiver after transfer)
   */
  async invalidateAccounts(accountNumbers = [], traceId) {
    if (!accountNumbers || accountNumbers.length === 0) return;

    const keys = accountNumbers.flatMap((acc) => [
      this.getBalanceKey(acc),
      this.getDetailsKey(acc),
    ]);

    const start = Date.now();

    try {
      const deletedCount = await this.redis.del(...keys);
      const durationMs = Date.now() - start;

      this.metrics.invalidations += deletedCount;

      logger.info('Cache INVALIDATE: multiple accounts deleted from Redis DB1', {
        accountNumbers,
        keys,
        deletedCount,
        traceId,
        durationMs,
      });
    } catch (error) {
      logger.warn('Cache error on invalidateAccounts', {
        accountNumbers,
        error: error.message,
        traceId,
      });
    }
  }

  /**
   * Expose collected metrics
   */
  getMetrics() {
    const avgWriteLatencyMs = this.metrics.sets > 0
      ? Number((this.metrics.writeLatencyTotalMs / this.metrics.sets).toFixed(2))
      : 0;

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      sets: this.metrics.sets,
      invalidations: this.metrics.invalidations,
      avgWriteLatencyMs,
      hitRatio: this.metrics.hits + this.metrics.misses > 0
        ? Number((this.metrics.hits / (this.metrics.hits + this.metrics.misses)).toFixed(4))
        : 0,
    };
  }
}

// Default shared instance
export const accountCache = new AccountCacheService();
