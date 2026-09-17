import { AccountService } from '../services/accountService.js';
import { ApiResponse, BadRequestError } from '@vaultcore/shared';

const accountService = new AccountService();

export class AccountController {
  static async createAccount(req, res, next) {
    try {
      const requestingUserId = req.user.userId;
      const requestingUserRole = req.user.role;
      const { customerId, type, currency, initialDeposit } = req.body;

      let targetUserId = requestingUserId;

      if (requestingUserRole === 'TELLER' || requestingUserRole === 'ADMIN') {
        if (!customerId) {
          throw new BadRequestError('customerId is required when creating an account as Teller or Admin');
        }
        targetUserId = customerId;
      } else {
        // If requester is CUSTOMER -> ignore customerId and create account for themselves
        targetUserId = requestingUserId;
      }

      const account = await accountService.createAccount(
        targetUserId,
        {
          type,
          currency,
          initialDeposit,
        },
        req.traceId
      );

      return ApiResponse.created(res, 'Bank account created successfully', account);
    } catch (error) {
      next(error);
    }
  }

  static async getAccountDetails(req, res, next) {
    try {
      const { accountNumber } = req.params;
      const account = await accountService.getAccountDetails(accountNumber, req.user.userId, req.user.role, req.traceId);
      return ApiResponse.success(res, 'Account details retrieved', account);
    } catch (error) {
      next(error);
    }
  }

  static async getAccountBalance(req, res, next) {
    try {
      const { accountNumber } = req.params;
      const balanceInfo = await accountService.getAccountBalance(accountNumber, req.user.userId, req.user.role, req.traceId);
      return ApiResponse.success(res, 'Current account balance retrieved', balanceInfo);
    } catch (error) {
      next(error);
    }
  }

  static async getUserAccounts(req, res, next) {
    try {
      const userId = req.user.userId;
      const page = req.query.page ? parseInt(req.query.page, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
      const result = await accountService.getUserAccounts(userId, page, limit, req.traceId);
      return ApiResponse.success(res, 'User bank accounts retrieved', result);
    } catch (error) {
      next(error);
    }
  }
}
