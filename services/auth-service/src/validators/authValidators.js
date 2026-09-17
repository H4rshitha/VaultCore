import { body } from 'express-validator';
import { ApiResponse } from '@vaultcore/shared';

export const parseCookies = (cookieHeader = '') => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((cookies, item) => {
    const [name, ...val] = item.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(val.join('='));
    return cookies;
  }, {});
};

export const signupValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('role')
    .optional()
    .isIn(['CUSTOMER', 'ADMIN', 'TELLER'])
    .withMessage('Role must be CUSTOMER, ADMIN, or TELLER'),
];

export const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

export const refreshValidation = [
  (req, res, next) => {
    const cookies = parseCookies(req.headers?.cookie);
    const token = req.body?.refreshToken || cookies?.refreshToken;
    if (!token) {
      return ApiResponse.error(res, 'Validation error', 400, [
        { field: 'refreshToken', message: 'Refresh Token is required' },
      ]);
    }
    req.refreshToken = token;
    next();
  },
];

export const logoutValidation = [
  (req, res, next) => {
    const cookies = parseCookies(req.headers?.cookie);
    req.refreshToken = req.body?.refreshToken || cookies?.refreshToken || null;
    next();
  },
];
