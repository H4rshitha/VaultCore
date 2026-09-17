import http from 'http';
import https from 'https';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { ApiResponse, circuitBreakerRegistry, CIRCUIT_STATES } from '@vaultcore/shared';
import { config } from '../config/index.js';

/**
 * Creates a reverse proxy middleware with service-specific timeouts, correlation tracing, user headers,
 * safe retry policy for idempotent GET requests, Circuit Breaker protection, and 502/504 error handling.
 *
 * @param {string} targetUrl - Downstream microservice URL
 * @param {string} serviceName - Friendly service identifier (e.g. 'Auth Service')
 * @param {Object} options - Custom options: { pathRewrite, timeoutKey, breakerName }
 */
export const createMicroserviceProxy = (targetUrl, serviceName, options = {}) => {
  const timeoutKey = options.timeoutKey || serviceName.toLowerCase().split(' ')[0];
  const serviceTimeout = config.timeouts[timeoutKey] || config.proxyTimeout || 5000;
  const customPathRewrite = typeof options === 'object' && options.pathRewrite ? options.pathRewrite : (options['^/'] ? options : undefined);
  const breakerName = options.breakerName || `${timeoutKey}-service`;
  const breaker = circuitBreakerRegistry.getOrCreate(breakerName);

  const proxyInstance = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    timeout: serviceTimeout,
    proxyTimeout: serviceTimeout,
    pathRewrite: customPathRewrite,
    on: {
      proxyReq: (proxyReq, req, res) => {
        // 1. Forward X-Trace-ID
        if (req.traceId) {
          proxyReq.setHeader('x-trace-id', req.traceId);
        }

        // 2. Forward Authenticated User Context
        if (req.user) {
          const userId = req.user.userId || req.user.id || req.user.sub;
          if (userId) proxyReq.setHeader('x-user-id', userId);
          if (req.user.role) proxyReq.setHeader('x-user-role', req.user.role);
          if (req.user.email) proxyReq.setHeader('x-user-email', req.user.email);
        }

        // 3. Fix parsed request body for POST/PUT/PATCH
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        } else {
          fixRequestBody(proxyReq, req);
        }
      },
      proxyRes: (proxyRes, req, res) => {
        // Echo X-Trace-ID back in gateway client response
        if (req.traceId) {
          proxyRes.headers['x-trace-id'] = req.traceId;
        }

        // Safe retry for GET requests on HTTP 503 (Service Unavailable)
        if (req.method === 'GET' && proxyRes.statusCode === 503 && !req._retried) {
          req._retried = true;
          // Consume response stream to prevent hanging
          proxyRes.resume();
          // Retry request through proxy once
          return proxyInstance(req, res, () => {});
        }
      },
      error: (err, req, res) => {
        const traceId = req.traceId || 'trace-unknown';
        if (!res.headersSent) {
          res.setHeader('x-trace-id', traceId);
        }

        // Record failure in Circuit Breaker on network/connection failure
        breaker.stats.failedRequests++;
        breaker.lastFailureTime = new Date().toISOString();
        breaker.lastFailureReason = err.message;

        if (breaker.state === CIRCUIT_STATES.HALF_OPEN) {
          breaker._transitionTo(CIRCUIT_STATES.OPEN, `Proxy error in HALF_OPEN: ${err.message}`);
        } else if (breaker.state === CIRCUIT_STATES.CLOSED) {
          breaker.consecutiveFailures++;
          if (breaker.consecutiveFailures >= breaker.failureThreshold) {
            breaker._transitionTo(CIRCUIT_STATES.OPEN, `Proxy failure threshold of ${breaker.failureThreshold} reached: ${err.message}`);
          }
        }

        // Safe retry for GET requests on connection reset / refused / timeout (1 retry maximum)
        const retryableErrors = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT'];
        if (req.method === 'GET' && retryableErrors.includes(err.code) && !req._retried) {
          req._retried = true;
          return proxyInstance(req, res, () => {});
        }

        if (res.headersSent) {
          return;
        }

        // Timeout Error -> HTTP 504 Gateway Timeout
        if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
          return ApiResponse.error(
            res,
            `Gateway timeout waiting for ${serviceName}`,
            504,
            { service: serviceName, code: 'GATEWAY_TIMEOUT', traceId, timeoutMs: serviceTimeout }
          );
        }

        // Downstream Unavailable -> HTTP 502 Bad Gateway
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
          return ApiResponse.error(
            res,
            `Downstream ${serviceName} is unavailable (${err.code})`,
            502,
            { service: serviceName, code: 'SERVICE_UNAVAILABLE', traceId }
          );
        }

        return ApiResponse.error(
          res,
          `Gateway proxy error communicating with ${serviceName}: ${err.message}`,
          502,
          { service: serviceName, code: 'PROXY_ERROR', traceId }
        );
      },
    },
  });

  return (req, res, next) => {
    const traceId = req.traceId || 'trace-unknown';

    // 1. Check Circuit Breaker State & Handle Fail Fast
    if (breaker.state === CIRCUIT_STATES.OPEN) {
      const timeSinceOpen = Date.now() - (breaker.openedAt || 0);
      if (timeSinceOpen < breaker.openTimeoutMs) {
        breaker.stats.failFastCount++;
        const retryAfterSec = Math.max(1, Math.ceil((breaker.openTimeoutMs - timeSinceOpen) / 1000));
        res.setHeader('Retry-After', retryAfterSec);

        return ApiResponse.error(
          res,
          `Circuit breaker for [${breaker.name}] is OPEN. Downstream service is currently unavailable.`,
          503,
          {
            code: 'CIRCUIT_BREAKER_OPEN',
            service: breaker.name,
            retryAfter: retryAfterSec,
            traceId,
          }
        );
      } else {
        breaker._transitionTo(CIRCUIT_STATES.HALF_OPEN, `Open timeout of ${breaker.openTimeoutMs}ms expired`);
      }
    }

    // 2. Track successful responses on finish
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 500) {
        breaker.stats.successfulRequests++;
        breaker.lastSuccessTime = new Date().toISOString();

        if (breaker.state === CIRCUIT_STATES.HALF_OPEN) {
          breaker.halfOpenSuccessCount++;
          if (breaker.halfOpenSuccessCount >= breaker.successThreshold) {
            breaker.stats.recoveryCount++;
            breaker._transitionTo(CIRCUIT_STATES.CLOSED, `Success threshold of ${breaker.successThreshold} met in HALF_OPEN`);
          }
        } else if (breaker.state === CIRCUIT_STATES.CLOSED) {
          breaker.consecutiveFailures = 0;
        }
      }
    });

    return proxyInstance(req, res, next);
  };
};

