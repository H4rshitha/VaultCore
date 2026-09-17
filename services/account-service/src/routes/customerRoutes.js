import { Router } from 'express';
import { CustomerController } from '../controllers/customerController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// All customer routes require authentication and Teller/Admin role check
router.use(authenticateToken);

router.get(['/search', '/customers/search'], CustomerController.searchCustomers);
router.get(['/:customerId', '/customers/:customerId'], CustomerController.getCustomerById);

export default router;
