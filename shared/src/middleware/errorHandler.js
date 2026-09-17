import { AppError } from '../utils/errors.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const errorHandler = (logger) => (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (logger) {
    logger.error(`${req.method} ${req.originalUrl} - Error: ${message}`, {
      stack: err.stack,
      statusCode,
      path: req.originalUrl,
      traceId: req.traceId,
    });
  }

  if (err instanceof AppError) {
    return ApiResponse.error(res, message, statusCode, err.details);
  }

  return ApiResponse.error(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message,
    statusCode
  );
};
