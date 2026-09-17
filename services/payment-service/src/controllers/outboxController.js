import { ApiResponse } from '@vaultcore/shared';
import { OutboxRepository } from '../repositories/outboxRepository.js';

export class OutboxController {
  constructor(workerInstance) {
    this.worker = workerInstance;
    this.repository = new OutboxRepository();
  }

  setWorker(worker) {
    this.worker = worker;
  }

  getStatus = async (req, res, next) => {
    try {
      let workerStatus = null;
      if (this.worker) {
        workerStatus = await this.worker.getStatus();
      } else {
        const dbStatus = await this.repository.getOutboxStatus();
        workerStatus = {
          worker: { isRunning: false, metrics: {} },
          outboxDatabase: dbStatus,
        };
      }

      return ApiResponse.success(res, 'Outbox status and statistics retrieved successfully', {
        status: 'OK',
        timestamp: new Date().toISOString(),
        ...workerStatus,
      });
    } catch (error) {
      next(error);
    }
  };
}
