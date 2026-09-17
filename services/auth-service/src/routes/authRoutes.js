import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import {
  signupValidation,
  loginValidation,
  refreshValidation,
  logoutValidation,
} from '../validators/authValidators.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/signup', signupValidation, validateRequest, AuthController.signup);
router.post('/login', loginValidation, validateRequest, AuthController.login);
router.post('/refresh', refreshValidation, validateRequest, AuthController.refresh);
router.post('/logout', logoutValidation, validateRequest, AuthController.logout);
router.get('/me', authenticateToken, AuthController.getProfile);

export default router;
