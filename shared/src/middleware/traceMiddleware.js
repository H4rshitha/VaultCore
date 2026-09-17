import { randomUUID } from 'node:crypto';

/**
 * Middleware that extracts or generates X-Trace-ID for end-to-end request correlation.
 * Propagates X-Trace-ID in response headers.
 */
export const traceMiddleware = (req, res, next) => {
  const incomingTraceId = req.headers['x-trace-id'] || (req.get && req.get('x-trace-id'));
  const traceId =
    incomingTraceId && typeof incomingTraceId === 'string' && incomingTraceId.trim()
      ? incomingTraceId.trim()
      : randomUUID();

  req.traceId = traceId;
  res.setHeader('X-Trace-ID', traceId);
  next();
};
