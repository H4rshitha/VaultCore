import { randomUUID } from 'node:crypto';
import { createRedisClient } from '../cache/redis.js';
import { REDIS_DATABASES, LOCK_CONSTANTS } from '../constants/index.js';
import { ConflictError } from '../utils/errors.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('distributed-lock');

// Lua script to ensure safe, atomic lock release only if the lock value (UUID) matches
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

export class LockService {
  constructor(options = {}) {
    this.redis =
      options.redis ||
      createRedisClient(
        {
          host: options.host || process.env.REDIS_HOST || 'localhost',
          port:
            options.port || (process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379),
          password: options.password || process.env.REDIS_PASSWORD || undefined,
          db: options.db !== undefined ? options.db : REDIS_DATABASES.DISTRIBUTED_LOCKS,
        },
        logger
      );

    this.metrics = {
      locksAcquired: 0,
      lockConflicts: 0,
      locksReleased: 0,
      idempotencyHitsRedis: 0,
      idempotencyHitsPostgres: 0,
      lockWaitTimeTotalMs: 0,
    };
  }

  getLockKey(accountNumber) {
    return `lock:account:${accountNumber}`;
  }

  getIdempotencyKey(idempotencyKey) {
    return `idempotency:${idempotencyKey}`;
  }

  /**
   * Acquire a single account lock using SET key value NX PX
   */
  async acquireLock(accountNumber, traceId, ttlMs = LOCK_CONSTANTS.LOCK_EXPIRATION_MS) {
    const key = this.getLockKey(accountNumber);
    const lockId = randomUUID();
    const start = Date.now();

    try {
      const result = await this.redis.set(key, lockId, 'NX', 'PX', ttlMs);
      const durationMs = Date.now() - start;

      if (result === 'OK') {
        this.metrics.locksAcquired++;
        this.metrics.lockWaitTimeTotalMs += durationMs;

        logger.info('Lock acquired successfully on Redis DB2', {
          key,
          accountNumber,
          lockId,
          ttlMs,
          traceId,
          durationMs,
        });

        return { key, lockId, accountNumber, ttlMs };
      }

      logger.warn('Lock acquisition failed (key already held by another process)', {
        key,
        accountNumber,
        traceId,
        durationMs,
      });

      return null;
    } catch (error) {
      logger.error('Redis error during lock acquisition', {
        key,
        accountNumber,
        error: error.message,
        traceId,
      });
      return null;
    }
  }

  /**
   * Safely release lock using Lua script (verifies lockId matches)
   */
  async releaseLock(lockInfo, traceId) {
    if (!lockInfo || !lockInfo.key || !lockInfo.lockId) return false;

    const { key, lockId, accountNumber } = lockInfo;
    const start = Date.now();

    try {
      const res = await this.redis.eval(RELEASE_LOCK_LUA, 1, key, lockId);
      const durationMs = Date.now() - start;

      if (res === 1) {
        this.metrics.locksReleased++;
        logger.info('Lock safely released via Lua script on Redis DB2', {
          key,
          accountNumber,
          lockId,
          traceId,
          durationMs,
        });
        return true;
      }

      logger.warn('Lock release ignored (lock expired or owned by another process)', {
        key,
        accountNumber,
        lockId,
        traceId,
        durationMs,
      });
      return false;
    } catch (error) {
      logger.error('Redis error during safe lock release', {
        key,
        accountNumber,
        error: error.message,
        traceId,
      });
      return false;
    }
  }

  /**
   * Acquire locks for multiple accounts in deterministic ascending order to prevent deadlocks
   * Throws 409 ConflictError if any lock fails and releases previously acquired locks
   */
  async acquireAccountLocks(
    accountNumbers = [],
    traceId,
    ttlMs = LOCK_CONSTANTS.LOCK_EXPIRATION_MS
  ) {
    // Sort account numbers in ascending alphabetical order to guarantee deadlock-free locking
    const sortedAccounts = [...new Set(accountNumbers.filter(Boolean))].sort();
    const acquiredLocks = [];

    for (const acc of sortedAccounts) {
      const lock = await this.acquireLock(acc, traceId, ttlMs);

      if (!lock) {
        this.metrics.lockConflicts++;
        logger.warn('Lock conflict detected, rolling back partial locks', {
          failedAccount: acc,
          allAccounts: sortedAccounts,
          acquiredCount: acquiredLocks.length,
          traceId,
        });

        // Release any locks acquired so far in reverse order
        await this.releaseAccountLocks(acquiredLocks, traceId);

        throw new ConflictError('Account is currently processing another transaction.');
      }

      acquiredLocks.push(lock);
    }

    return acquiredLocks;
  }

  /**
   * Release multiple account locks safely
   */
  async releaseAccountLocks(acquiredLocks = [], traceId) {
    if (!acquiredLocks || acquiredLocks.length === 0) return;

    for (const lock of acquiredLocks) {
      await this.releaseLock(lock, traceId);
    }
  }

  /**
   * Execute callback with deterministic distributed locks and guaranteed release in try/finally
   */
  async withAccountLocks(
    accountNumbers = [],
    traceId,
    callback,
    ttlMs = LOCK_CONSTANTS.LOCK_EXPIRATION_MS
  ) {
    const locks = await this.acquireAccountLocks(accountNumbers, traceId, ttlMs);
    try {
      return await callback();
    } finally {
      await this.releaseAccountLocks(locks, traceId);
    }
  }

  /**
   * Fetch idempotency record from Redis DB2 (Layer 1 Idempotency)
   */
  async getIdempotencyRecord(idempotencyKey, traceId) {
    const key = this.getIdempotencyKey(idempotencyKey);
    const start = Date.now();

    try {
      const data = await this.redis.get(key);
      const durationMs = Date.now() - start;

      if (data) {
        this.metrics.idempotencyHitsRedis++;
        logger.info('Idempotency HIT (Layer 1 Redis DB2)', {
          key,
          idempotencyKey,
          traceId,
          durationMs,
        });
        return JSON.parse(data);
      }

      logger.info('Idempotency MISS (Layer 1 Redis DB2)', {
        key,
        idempotencyKey,
        traceId,
        durationMs,
      });
      return null;
    } catch (error) {
      logger.warn('Redis error during idempotency lookup, falling back to PostgreSQL', {
        idempotencyKey,
        error: error.message,
        traceId,
      });
      return null;
    }
  }

  /**
   * Store idempotency record in Redis DB2 with 24h TTL
   */
  async setIdempotencyRecord(
    idempotencyKey,
    data,
    traceId,
    ttlSeconds = LOCK_CONSTANTS.IDEMPOTENCY_TTL_SECONDS
  ) {
    const key = this.getIdempotencyKey(idempotencyKey);
    const start = Date.now();

    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
      const durationMs = Date.now() - start;

      logger.info('Idempotency record stored in Redis DB2 (TTL 24h)', {
        key,
        idempotencyKey,
        ttlSeconds,
        traceId,
        durationMs,
      });
    } catch (error) {
      logger.warn('Redis error storing idempotency record', {
        idempotencyKey,
        error: error.message,
        traceId,
      });
    }
  }

  /**
   * Return collected locking & idempotency metrics
   */
  getMetrics() {
    const avgLockWaitMs =
      this.metrics.locksAcquired > 0
        ? Number((this.metrics.lockWaitTimeTotalMs / this.metrics.locksAcquired).toFixed(2))
        : 0;

    return {
      locksAcquired: this.metrics.locksAcquired,
      lockConflicts: this.metrics.lockConflicts,
      locksReleased: this.metrics.locksReleased,
      idempotencyHitsRedis: this.metrics.idempotencyHitsRedis,
      idempotencyHitsPostgres: this.metrics.idempotencyHitsPostgres,
      avgLockWaitMs,
    };
  }
}

// Default shared instance
export const lockService = new LockService();
