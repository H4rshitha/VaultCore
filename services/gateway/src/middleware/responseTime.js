/**
 * Response Time Middleware
 * Measures request duration, sets X-Response-Time header, and records responseTimeMs for logging.
 */
export const responseTimeMiddleware = (req, res, next) => {
  const startHrTime = process.hrtime.bigint();

  // Hook into setHeader / writeHead so header is emitted before body transmission
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    const elapsedNano = process.hrtime.bigint() - startHrTime;
    const elapsedMs = Number(elapsedNano) / 1e6;
    const formattedTime = `${elapsedMs.toFixed(2)}ms`;

    res.setHeader('X-Response-Time', formattedTime);
    res.locals.responseTimeMs = parseFloat(elapsedMs.toFixed(2));
    req.responseTimeMs = res.locals.responseTimeMs;

    return originalWriteHead.apply(this, args);
  };

  next();
};
