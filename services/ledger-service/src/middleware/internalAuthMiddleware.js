import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '@vaultcore/shared';

/**
 * Middleware ensuring only trusted internal services (e.g. Payment Service or API Gateway)
 * can access internal ledger endpoints via x-service-api-key header.
 */
export const authenticateInternalService = (req, res, next) => {
  const serviceApiKey = req.headers['x-service-api-key'];

  if (!serviceApiKey) {
    return next(new UnauthorizedError('Missing required internal service API key (x-service-api-key)'));
  }

  if (serviceApiKey !== config.internalApiKey) {
    return next(new ForbiddenError('Forbidden: Invalid internal service API key'));
  }

  req.isInternalService = true;
  next();
};
