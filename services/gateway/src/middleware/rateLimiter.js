import { rateLimiterService, RATE_LIMIT_CONFIG, ApiResponse, createLogger } from '@vaultcore/shared';
import { rateLimitAllowedTotal, rateLimitBlockedTotal } from './metrics.js';

const logger = createLogger('rate-limiter-middleware');

const EXCLUDED_ROUTES = ['/health', '/metrics', '/docs', '/admin'];

/**
 * Check if request path should completely bypass rate limiting
 */
export const isExcludedRoute = (req) => {
  const path = req.path || req.originalUrl || '';
  return EXCLUDED_ROUTES.some((excluded) => path === excluded || path.startsWith(`${excluded}/`));
};

/**
 * Determine real client IP using priority:
 * 1. req.ip (populated by Express when trust proxy is enabled)
 * 2. X-Forwarded-For (first IP in comma-separated list)
 * 3. req.socket.remoteAddress
 */
export const getClientIp = (req) => {
  if (req.ip && typeof req.ip === 'string') {
    return req.ip;
  }
  const xForwardedFor = req.headers && req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const raw = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    const firstIp = raw.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
};

/**
 * Factory creating route-specific sliding window rate limiter middleware using Redis DB0
 *
 * @param {Object} options
 * @param {number} options.limit - Max allowed requests within window
 * @param {number} options.windowSeconds - Window size in seconds (default 60s)
 * @param {string} options.tierName - Friendly name for the rate limit tier (AUTH, PAYMENT, GENERAL)
 * @param {Function} [options.keyGenerator] - Optional custom key generator (req) => string
 */
export const createRateLimiter = (options = {}) => {
  const limit = options.limit || 100;
  const windowSeconds = options.windowSeconds || 60;
  const tierName = options.tierName || 'GENERAL';
  const customKeyGenerator = options.keyGenerator;

  return async (req, res, next) => {
    // Bypass infrastructure routes (/health, /metrics, /docs)
    if (isExcludedRoute(req)) {
      return next();
    }

    const clientIp = getClientIp(req);
    const userId = req.user ? (req.user.userId || req.user.id || req.user.sub) : null;

    // Generate Redis DB0 key format: rate:user:{userId} or rate:ip:{ipAddress}
    let key;
    if (customKeyGenerator) {
      key = customKeyGenerator(req);
    } else if (userId) {
      key = `rate:user:${userId}`;
    } else {
      key = `rate:ip:${clientIp}`;
    }

    const checkResult = await rateLimiterService.checkRateLimit(key, limit, windowSeconds);

    // RFC-compliant integer seconds for Retry-After and Unix timestamp in seconds for X-RateLimit-Reset
    const retryAfterSec = Math.max(1, Math.ceil(Number(checkResult.retryAfter) || 1));
    const resetTimeSec = Math.max(0, Math.ceil(Number(checkResult.resetTime) || Math.ceil((Date.now() + windowSeconds * 1000) / 1000)));

    // Set standard rate limit headers on response
    res.setHeader('X-RateLimit-Limit', checkResult.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, checkResult.remaining));
    res.setHeader('X-RateLimit-Reset', resetTimeSec);

    const logMetadata = {
      traceId: req.traceId || 'trace-unknown',
      userId: userId || 'anonymous',
      ip: clientIp,
      endpoint: req.originalUrl || req.path,
      method: req.method,
      tier: tierName,
      key,
      limit: checkResult.limit,
      quotaRemaining: Math.max(0, checkResult.remaining),
      latencyMs: checkResult.latencyMs,
    };

    if (!checkResult.allowed) {
      rateLimitBlockedTotal.inc({ tier: tierName });
      res.setHeader('Retry-After', retryAfterSec);

      logger.warn(`Rate limit exceeded for [${key}] on endpoint [${req.method} ${req.originalUrl || req.path}]`, {
        ...logMetadata,
        retryAfter: retryAfterSec,
      });

      return ApiResponse.error(
        res,
        'Too many requests. Please try again later.',
        429,
        {
          code: 'RATE_LIMIT_EXCEEDED',
          tier: tierName,
          limit: checkResult.limit,
          retryAfter: retryAfterSec,
          resetTime: resetTimeSec,
          traceId: req.traceId,
        }
      );
    }

    // Quota available -> log and proceed
    rateLimitAllowedTotal.inc({ tier: tierName });
    logger.info(`Rate limit quota checked: ${checkResult.remaining}/${checkResult.limit} remaining for [${key}]`, logMetadata);
    next();
  };
};

/**
 * Pre-configured Rate Limiters
 */

// 1. Auth APIs: 10 requests / minute per IP
export const authRateLimiter = createRateLimiter({
  limit: RATE_LIMIT_CONFIG.AUTH.LIMIT,
  windowSeconds: RATE_LIMIT_CONFIG.AUTH.WINDOW_SECONDS,
  tierName: 'AUTH',
  keyGenerator: (req) => {
    const clientIp = getClientIp(req);
    return `rate:ip:${clientIp}`;
  },
});

// 2. Payment APIs: 20 sustained + 5 burst (total 25) requests / minute per authenticated user (or IP if unauthenticated)
export const paymentRateLimiter = createRateLimiter({
  limit: RATE_LIMIT_CONFIG.PAYMENT.LIMIT,
  windowSeconds: RATE_LIMIT_CONFIG.PAYMENT.WINDOW_SECONDS,
  tierName: 'PAYMENT',
  keyGenerator: (req) => {
    const userId = req.user ? (req.user.userId || req.user.id || req.user.sub) : null;
    if (userId) return `rate:user:${userId}`;
    const clientIp = getClientIp(req);
    return `rate:ip:${clientIp}`;
  },
});

// 3. General APIs: 100 requests / minute per user (or IP if unauthenticated)
export const generalRateLimiter = createRateLimiter({
  limit: RATE_LIMIT_CONFIG.GENERAL.LIMIT,
  windowSeconds: RATE_LIMIT_CONFIG.GENERAL.WINDOW_SECONDS,
  tierName: 'GENERAL',
  keyGenerator: (req) => {
    const userId = req.user ? (req.user.userId || req.user.id || req.user.sub) : null;
    if (userId) return `rate:user:${userId}`;
    const clientIp = getClientIp(req);
    return `rate:ip:${clientIp}`;
  },
});
