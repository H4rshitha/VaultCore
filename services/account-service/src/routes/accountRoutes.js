import { Router } from 'express';
import { AccountController } from '../controllers/accountController.js';
import {
  createAccountValidation,
  getAccountParamsValidation,
  listAccountsQueryValidation,
} from '../validators/accountValidators.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all account routes with JWT authentication
router.use(authenticateToken);

router.post('/', createAccountValidation, validateRequest, AccountController.createAccount);
router.get('/', listAccountsQueryValidation, validateRequest, AccountController.getUserAccounts);
router.get('/:accountNumber', getAccountParamsValidation, validateRequest, AccountController.getAccountDetails);
router.get('/:accountNumber/balance', getAccountParamsValidation, validateRequest, AccountController.getAccountBalance);

export default router;
