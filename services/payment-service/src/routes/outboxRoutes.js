import { Router } from 'express';
import { OutboxController } from '../controllers/outboxController.js';

export const createOutboxRoutes = (workerInstance) => {
  const router = Router();
  const controller = new OutboxController(workerInstance);

  // Status and monitoring endpoint
  router.get('/status', controller.getStatus);
  router.get('/api/v1/outbox/status', controller.getStatus);

  return { router, controller };
};

const defaultRouter = Router();
const defaultController = new OutboxController(null);
defaultRouter.get('/status', defaultController.getStatus);
defaultRouter.get('/api/v1/outbox/status', defaultController.getStatus);

export default defaultRouter;
