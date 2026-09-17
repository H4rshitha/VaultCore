import { body, param, query } from 'express-validator';

export const transferValidation = [
  body('idempotencyKey').isUUID().withMessage('idempotencyKey must be a valid UUID'),
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
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number greater than 0'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .toUpperCase()
    .withMessage('Currency must be a 3-character ISO code (e.g. USD)'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Description cannot exceed 255 characters'),
];

export const getPaymentParamsValidation = [
  param('referenceId').trim().notEmpty().withMessage('referenceId parameter is required'),
];

export const listPaymentsQueryValidation = [
  query('cursor').optional().isString(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('status')
    .optional()
    .isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'])
    .withMessage('Status must be PENDING, PROCESSING, COMPLETED, FAILED, or REVERSED'),
  query('type')
    .optional()
    .isIn(['TRANSFER', 'DEPOSIT', 'WITHDRAWAL'])
    .withMessage('Type must be TRANSFER, DEPOSIT, or WITHDRAWAL'),
  query('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('minAmount must be a non-negative number')
    .toFloat(),
  query('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('maxAmount must be a non-negative number')
    .toFloat(),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO 8601 date'),
  query('referenceId').optional().trim(),
];

export const searchPaymentsQueryValidation = [
  query('referenceId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('referenceId must be between 1 and 100 characters'),
  query('accountNumber')
    .optional()
    .trim()
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('accountNumber must be a 12-digit numeric string'),
  query('status')
    .optional()
    .isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'])
    .withMessage('Status must be PENDING, PROCESSING, COMPLETED, FAILED, or REVERSED'),
  query('type')
    .optional()
    .isIn(['TRANSFER', 'DEPOSIT', 'WITHDRAWAL'])
    .withMessage('Type must be TRANSFER, DEPOSIT, or WITHDRAWAL'),
  query('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('minAmount must be a non-negative number')
    .toFloat(),
  query('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('maxAmount must be a non-negative number')
    .toFloat(),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO 8601 date'),
  query('cursor').optional().isString(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

export const getPaymentSummaryValidation = [
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO 8601 date'),
  query('accountNumber')
    .optional()
    .trim()
    .isLength({ min: 12, max: 12 })
    .isNumeric()
    .withMessage('accountNumber must be a 12-digit numeric string'),
  query('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .toUpperCase()
    .withMessage('Currency must be a 3-character ISO code (e.g. USD)'),
];
