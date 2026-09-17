import { apiClient } from './client.js';
import { notificationStorage } from '../utils/storage.js';

export const notificationApi = {
  /**
   * Fetch customer notifications with optional filtering (status, type, limit, cursor).
   * Supports /notifications and fallbacks to /notifications/history.
   */
  getNotifications: async (params = {}) => {
    const cleanParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
        cleanParams[key] = value;
      }
    }

    try {
      const response = await apiClient.get('/notifications', { params: cleanParams });
      return response.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 502) {
        // Fallback to /notifications/history if /notifications is not directly mapped
        const fallback = await apiClient.get('/notifications/history', { params: cleanParams });
        return fallback.data;
      }
      throw err;
    }
  },

  /**
   * Fetch paginated notification audit history from notification service.
   *
   * @param {Object} params - Query filters (cursor, limit, status, type, startDate, endDate, transactionId, recipient)
   */
  getNotificationHistory: async (params = {}) => {
    const cleanParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
        cleanParams[key] = value;
      }
    }

    const response = await apiClient.get('/notifications/history', { params: cleanParams });
    return response.data;
  },

  /**
   * Mark a single notification as read by ID.
   */
  markAsRead: async (notificationId) => {
    notificationStorage.markAsRead(notificationId);
    try {
      const response = await apiClient.patch(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (err) {
      return { success: true, id: notificationId, read: true, status: 'READ' };
    }
  },

  /**
   * Mark all customer notifications as read.
   */
  markAllAsRead: async (notificationIds = []) => {
    notificationStorage.markAllAsRead(notificationIds);
    try {
      const response = await apiClient.patch('/notifications/read-all');
      return response.data;
    } catch (err) {
      return { success: true, readAll: true, message: 'All notifications marked as read' };
    }
  },
};
