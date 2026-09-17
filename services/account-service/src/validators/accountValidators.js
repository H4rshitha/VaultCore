import { body, param, query } from 'express-validator';

const ALLOWED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY'];

export const createAccountValidation = [
  body('type')
    .optional()
    .isIn(['SAVINGS', 'CHECKING', 'INVESTMENT'])
    .withMessage('Account type must be SAVINGS, CHECKING, or INVESTMENT'),
  body('currency')
    .optional()
    .toUpperCase()
    .isIn(ALLOWED_CURRENCIES)
    .withMessage(`Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`),
  body('initialDeposit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Initial deposit cannot be negative'),
  body('customerId')
    .optional()
    .isString()
    .withMessage('customerId must be a string'),
];

export const getAccountParamsValidation = [
  param('accountNumber')
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Account number must be a 12-digit numeric string'),
];

export const listAccountsQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];
