import { body, param, query } from 'express-validator';

export const postDoubleEntryValidation = [
  body('idempotencyKey')
    .isUUID()
    .withMessage('idempotencyKey must be a valid UUID'),
  body('referenceId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('referenceId must be a non-empty string'),
  body('sourceAccountNumber')
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Source account number must be a 12-digit numeric string'),
  body('targetAccountNumber')
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Target account number must be a 12-digit numeric string')
    .custom((value, { req }) => {
      if (value === req.body.sourceAccountNumber) {
        throw new Error('Target account number cannot be identical to source account number');
      }
      return true;
    }),
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number greater than 0'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .toUpperCase()
    .withMessage('Currency must be a 3-character ISO code'),
  body('description')
    .optional()
    .trim(),
];

export const getLedgerHistoryValidation = [
  param('accountNumber')
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('Account number must be a 12-digit numeric string'),
  query('cursor')
    .optional()
    .isString(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('type')
    .optional()
    .isIn(['DEBIT', 'CREDIT'])
    .withMessage('Type must be DEBIT or CREDIT'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
  query('referenceId')
    .optional()
    .trim(),
];
