import { query } from 'express-validator';
import { validateRequest } from '@vaultcore/shared';

export const validateNotificationHistory = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
  query('cursor')
    .optional()
    .isUUID()
    .withMessage('Cursor must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['PENDING', 'SENT', 'FAILED', 'DELIVERED'])
    .withMessage('Invalid notification status filter'),
  query('type')
    .optional()
    .isIn(['EMAIL', 'SMS', 'PUSH'])
    .withMessage('Invalid notification type filter'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be an ISO8601 string'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be an ISO8601 string'),
  validateRequest,
];
