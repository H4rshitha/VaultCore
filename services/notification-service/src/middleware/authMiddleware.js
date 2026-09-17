import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '@vaultcore/shared';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
      return next();
    } catch {
      // Continue to check gateway headers if direct token verification fails
    }
  }

  // Check verified headers forwarded by API Gateway
  if (req.headers['x-user-id'] || req.headers['x-user-role']) {
    req.user = {
      id: req.headers['x-user-id'],
      userId: req.headers['x-user-id'],
      role: req.headers['x-user-role'] || 'CUSTOMER',
      email: req.headers['x-user-email'] || 'customer@vaultcore.io',
    };
    return next();
  }

  return next(new UnauthorizedError('Missing or invalid Authorization header'));
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
};
