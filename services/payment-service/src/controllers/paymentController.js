import { PaymentService } from '../services/paymentService.js';
import { ApiResponse } from '@vaultcore/shared';

const paymentService = new PaymentService();

export class PaymentController {
  static async transfer(req, res, next) {
    try {
      const userContext = {
        userId: req.user.userId,
        role: req.user.role,
        email: req.user.email,
      };

      const metaContext = {
        traceId: req.traceId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await paymentService.processTransfer(userContext, req.body, metaContext);
      const statusCode = result.isIdempotent ? 200 : 201;
      return ApiResponse.success(res, 'Payment processed successfully', result, statusCode);
    } catch (error) {
      next(error);
    }
  }

  static async deposit(req, res, next) {
    try {
      const userContext = {
        userId: req.user.userId,
        role: req.user.role,
        email: req.user.email,
      };

      const metaContext = {
        traceId: req.traceId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await paymentService.processDeposit(userContext, req.body, metaContext);
      const statusCode = result.isIdempotent ? 200 : 201;
      return ApiResponse.success(res, 'Deposit processed successfully', result, statusCode);
    } catch (error) {
      next(error);
    }
  }

  static async withdraw(req, res, next) {
    try {
      const userContext = {
        userId: req.user.userId,
        role: req.user.role,
        email: req.user.email,
      };

      const metaContext = {
        traceId: req.traceId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await paymentService.processWithdrawal(userContext, req.body, metaContext);
      const statusCode = result.isIdempotent ? 200 : 201;
      return ApiResponse.success(res, 'Withdrawal processed successfully', result, statusCode);
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentByReference(req, res, next) {
    try {
      const { referenceId } = req.params;
      const userContext = {
        userId: req.user.userId,
        role: req.user.role,
      };

      const payment = await paymentService.getPaymentByReference(
        referenceId,
        userContext,
        req.traceId
      );
      return ApiResponse.success(res, 'Payment details retrieved', payment);
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentHistory(req, res, next) {
    try {
      const userContext = {
        userId: req.user.userId,
        role: req.user.role,
      };

      const filters = {
        cursor: req.query.cursor,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
        status: req.query.status,
        type: req.query.type,
        minAmount: req.query.minAmount !== undefined ? parseFloat(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount !== undefined ? parseFloat(req.query.maxAmount) : undefined,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        referenceId: req.query.referenceId,
      };

      const history = await paymentService.getPaymentHistory(userContext, filters, req.traceId);
      return ApiResponse.success(res, 'Payment history retrieved successfully', history);
    } catch (error) {
      next(error);
    }
  }

  static async searchPayments(req, res, next) {
    try {
      const userContext = {
        userId: req.user.userId,
        role: req.user.role,
      };

      const filters = {
        referenceId: req.query.referenceId,
        accountNumber: req.query.accountNumber,
        status: req.query.status,
        type: req.query.type,
        minAmount: req.query.minAmount !== undefined ? parseFloat(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount !== undefined ? parseFloat(req.query.maxAmount) : undefined,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        cursor: req.query.cursor,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
      };

      const searchResults = await paymentService.searchPayments(userContext, filters, req.traceId);
      return ApiResponse.success(
        res,
        'Payment search results retrieved successfully',
        searchResults
      );
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentSummary(req, res, next) {
    try {
      const userContext = {
        userId: req.user.userId,
        role: req.user.role,
      };

      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        accountNumber: req.query.accountNumber,
        currency: req.query.currency,
      };

      const summary = await paymentService.getFinancialSummary(userContext, filters, req.traceId);
      return ApiResponse.success(
        res,
        'Financial dashboard summary retrieved successfully',
        summary
      );
    } catch (error) {
      next(error);
    }
  }
}
