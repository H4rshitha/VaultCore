export const requestLogger = (logger) => (req, res, next) => {
  if (req.path === '/metrics' || req.originalUrl === '/metrics') {
    return next();
  }
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      traceId: req.traceId,
    });
  });
  next();
};
