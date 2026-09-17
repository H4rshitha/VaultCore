import { LedgerService } from '../services/ledgerService.js';
import { ApiResponse } from '@vaultcore/shared';

const ledgerService = new LedgerService();

export class LedgerController {
  static async recordTransfer(req, res, next) {
    try {
      const result = await ledgerService.recordDoubleEntryTransfer(req.body, req.traceId);
      const statusCode = result.isIdempotent ? 200 : 201;
      return ApiResponse.success(
        res,
        'Double-entry transfer recorded successfully',
        result,
        statusCode
      );
    } catch (error) {
      next(error);
    }
  }

  static async getAccountLedgerHistory(req, res, next) {
    try {
      const { accountNumber } = req.params;
      const filters = {
        cursor: req.query.cursor,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
        type: req.query.type,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        referenceId: req.query.referenceId,
      };

      const result = await ledgerService.getAccountLedgerHistory(
        accountNumber,
        req.user.userId,
        req.user.role,
        filters,
        req.traceId
      );

      return ApiResponse.success(res, 'Account ledger history retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
