import { validationResult } from 'express-validator';
import { ApiResponse } from '../utils/apiResponse.js';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return ApiResponse.error(res, 'Validation error', 400, details);
  }
  next();
};
