import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * JWT Bearer token authentication middleware.
 * Decodes and attaches req.user = { userId, role, ... } from the verified token.
 */
export const authenticateToken = (jwtSecret) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
};

/**
 * Role-Based Access Control (RBAC) middleware.
 *
 * Must be used AFTER authenticateToken (requires req.user to be set).
 *
 * Usage:
 *   router.delete('/accounts/:id', authenticateToken(secret), authorizeRoles('ADMIN'), handler);
 *   router.get('/ledger', authenticateToken(secret), authorizeRoles('ADMIN', 'TELLER'), handler);
 *
 * @param {...string} roles - One or more permitted roles (e.g. 'ADMIN', 'TELLER', 'CUSTOMER')
 */
export const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRole = req.user.role;
    if (!userRole || !roles.includes(userRole)) {
      return next(
        new ForbiddenError(
          `Access denied: requires role ${roles.join(' or ')} — your role is ${userRole || 'unknown'}`
        )
      );
    }

    next();
  };
