import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';

/**
 * Generate Access Token with minimal payload: userId, email, role
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

/**
 * Generate Refresh Token containing userId and standard JWT jti claim
 */
export const generateRefreshToken = (user, jti = randomUUID()) => {
  const token = jwt.sign(
    {
      userId: user.id,
      jti,
      tokenType: 'REFRESH',
    },
    config.refreshTokenSecret,
    { expiresIn: config.refreshTokenExpiresIn }
  );
  return { token, jti };
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.refreshTokenSecret);
};
