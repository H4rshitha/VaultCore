import { Router } from 'express';
import { LedgerController } from '../controllers/ledgerController.js';
import {
  postDoubleEntryValidation,
  postDepositValidation,
  postWithdrawalValidation,
  getLedgerHistoryValidation,
} from '../validators/ledgerValidators.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authenticateInternalService } from '../middleware/internalAuthMiddleware.js';

const router = Router();

/**
 * [INTERNAL] Double-Entry Ledger Posting
 * Intended to be called only by internal microservices (Payment Service or Gateway) with x-service-api-key
 */
router.post(
  '/entries',
  authenticateInternalService,
  postDoubleEntryValidation,
  validateRequest,
  LedgerController.recordTransfer
);

router.post(
  '/entries/deposit',
  authenticateInternalService,
  postDepositValidation,
  validateRequest,
  LedgerController.recordDeposit
);

router.post(
  '/entries/withdraw',
  authenticateInternalService,
  postWithdrawalValidation,
  validateRequest,
  LedgerController.recordWithdrawal
);

/**
 * [PUBLIC] Account Ledger History
 * Protected by user JWT Bearer authentication
 */
router.get(
  '/accounts/:accountNumber/entries',
  authenticateToken,
  getLedgerHistoryValidation,
  validateRequest,
  LedgerController.getAccountLedgerHistory
);

export default router;
