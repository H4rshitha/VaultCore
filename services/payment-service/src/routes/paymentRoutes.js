import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import {
  transferValidation,
  getPaymentParamsValidation,
  listPaymentsQueryValidation,
  searchPaymentsQueryValidation,
  getPaymentSummaryValidation,
} from '../validators/paymentValidators.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all payment endpoints with JWT authentication
router.use(authenticateToken);

router.post('/transfer', transferValidation, validateRequest, PaymentController.transfer);
router.get('/history', listPaymentsQueryValidation, validateRequest, PaymentController.getPaymentHistory);
router.get('/search', searchPaymentsQueryValidation, validateRequest, PaymentController.searchPayments);
router.get('/summary', getPaymentSummaryValidation, validateRequest, PaymentController.getPaymentSummary);
router.get('/:referenceId', getPaymentParamsValidation, validateRequest, PaymentController.getPaymentByReference);

export default router;
