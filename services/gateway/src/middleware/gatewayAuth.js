import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError } from '@vaultcore/shared';

// Public endpoints that bypass gateway authentication
const PUBLIC_PATHS = [
  /^\/api\/v1\/auth\/signup(\/)?$/,
  /^\/api\/v1\/auth\/login(\/)?$/,
  /^\/api\/v1\/auth\/refresh(\/)?$/,
  /^\/auth\/signup(\/)?$/,
  /^\/auth\/login(\/)?$/,
  /^\/auth\/refresh(\/)?$/,
  /^\/health(\/.*)?$/,
  /^\/api\/v1\/health(\/.*)?$/,
  /^\/docs(\/.*)?$/,
  /^\/metrics(\/.*)?$/,
  /^\/api\/v1\/metrics(\/.*)?$/,
  /^\/admin\/circuit-breakers(\/)?$/,
  /^\/api\/v1\/admin\/circuit-breakers(\/)?$/,
  /^\/outbox\/status(\/)?$/,
  /^\/api\/v1\/outbox\/status(\/)?$/,
  /^\/favicon\.ico$/,
];

export const isPublicPath = (path) => {
  return PUBLIC_PATHS.some((regex) => regex.test(path));
};

export const gatewayAuthMiddleware = (req, res, next) => {
  // Check if current path is whitelisted
  if (isPublicPath(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;

    // Inject authenticated user context into downstream request headers
    const userId = decoded.userId || decoded.id || decoded.sub;
    if (userId) req.headers['x-user-id'] = userId;
    if (decoded.role) req.headers['x-user-role'] = decoded.role;
    if (decoded.email) req.headers['x-user-email'] = decoded.email;

    next();
  } catch (error) {
    return next(new UnauthorizedError('Invalid or expired Access Token'));
  }
};
