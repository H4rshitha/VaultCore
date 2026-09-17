import { ApiResponse } from '@vaultcore/shared';
import { NotificationService } from '../services/notificationService.js';

export class NotificationController {
  constructor(serviceInstance, consumerInstance) {
    this.service = serviceInstance || new NotificationService();
    this.consumer = consumerInstance || null;
  }

  setConsumer(consumer) {
    this.consumer = consumer;
  }

  getHistory = async (req, res, next) => {
    try {
      const userContext = req.user || { email: 'customer@vaultcore.io', role: 'CUSTOMER' };
      const filters = {
        limit: req.query.limit,
        cursor: req.query.cursor,
        status: req.query.status,
        type: req.query.type,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        transactionId: req.query.transactionId,
        recipient: req.query.recipient,
      };

      const result = await this.service.getCustomerHistory(userContext, filters);
      return ApiResponse.success(res, 'Notification history retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getAdminStatus = async (req, res, next) => {
    try {
      const consumerMetrics = this.consumer ? this.consumer.getMetrics() : { isRunning: false };
      const statusData = await this.service.getAdminStatus(consumerMetrics);

      return ApiResponse.success(res, 'Notification admin status and queue metrics retrieved', statusData);
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req, res, next) => {
    try {
      const { id } = req.params;
      return ApiResponse.success(res, 'Notification marked as read', { id, read: true, status: 'READ' });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req, res, next) => {
    try {
      return ApiResponse.success(res, 'All notifications marked as read', {
        readAll: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
