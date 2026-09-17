import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import { validateNotificationHistory } from '../validators/notificationValidators.js';

export const createNotificationRoutes = (consumerInstance) => {
  const router = Router();
  const controller = new NotificationController(null, consumerInstance);

  // Customer notification history & management
  router.get('/history', authenticateToken, validateNotificationHistory, controller.getHistory);
  router.get(
    '/api/v1/notifications/history',
    authenticateToken,
    validateNotificationHistory,
    controller.getHistory
  );
  router.get('/', authenticateToken, controller.getHistory);
  router.get('/api/v1/notifications', authenticateToken, controller.getHistory);

  // Mark as read
  router.patch('/read-all', authenticateToken, controller.markAllAsRead);
  router.patch('/api/v1/notifications/read-all', authenticateToken, controller.markAllAsRead);
  router.patch('/:id/read', authenticateToken, controller.markAsRead);
  router.patch('/api/v1/notifications/:id/read', authenticateToken, controller.markAsRead);

  // Admin queue & delivery status
  router.get('/admin/status', authenticateToken, requireRole('ADMIN'), controller.getAdminStatus);
  router.get(
    '/api/v1/notifications/admin/status',
    authenticateToken,
    requireRole('ADMIN'),
    controller.getAdminStatus
  );

  // Legacy logs endpoint
  router.get('/logs', authenticateToken, controller.getHistory);

  return { router, controller };
};

const defaultRouter = Router();
const defaultController = new NotificationController(null, null);

defaultRouter.get(
  '/history',
  authenticateToken,
  validateNotificationHistory,
  defaultController.getHistory
);
defaultRouter.get(
  '/api/v1/notifications/history',
  authenticateToken,
  validateNotificationHistory,
  defaultController.getHistory
);
defaultRouter.get('/', authenticateToken, defaultController.getHistory);
defaultRouter.get('/api/v1/notifications', authenticateToken, defaultController.getHistory);
defaultRouter.patch('/read-all', authenticateToken, defaultController.markAllAsRead);
defaultRouter.patch(
  '/api/v1/notifications/read-all',
  authenticateToken,
  defaultController.markAllAsRead
);
defaultRouter.patch('/:id/read', authenticateToken, defaultController.markAsRead);
defaultRouter.patch(
  '/api/v1/notifications/:id/read',
  authenticateToken,
  defaultController.markAsRead
);
defaultRouter.get(
  '/admin/status',
  authenticateToken,
  requireRole('ADMIN'),
  defaultController.getAdminStatus
);
defaultRouter.get(
  '/api/v1/notifications/admin/status',
  authenticateToken,
  requireRole('ADMIN'),
  defaultController.getAdminStatus
);
defaultRouter.get('/logs', authenticateToken, defaultController.getHistory);

export default defaultRouter;
