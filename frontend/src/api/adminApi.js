import { apiClient } from './client.js';

export const adminApi = {
  /**
   * Fetch status of all downstream circuit breakers (Ledger, RabbitMQ, Notification).
   */
  getCircuitBreakers: async () => {
    const response = await apiClient.get('/admin/circuit-breakers');
    return response.data;
  },

  /**
   * Fetch transactional outbox worker processing status.
   */
  getOutboxStatus: async () => {
    const response = await apiClient.get('/outbox/status');
    return response.data;
  },

  /**
   * Fetch notification worker delivery queues and admin status.
   */
  getNotificationStatus: async () => {
    const response = await apiClient.get('/notifications/admin/status');
    return response.data;
  },

  /**
   * Fetch Prometheus metrics exposition.
   */
  getMetrics: async () => {
    const response = await apiClient.get('/metrics', {
      headers: { Accept: 'text/plain, application/json' },
    });
    return response.data;
  },

  /**
   * Fetch Gateway overview and liveness health status.
   */
  getHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  /**
   * Fetch complete readiness dependency status (PostgreSQL, Redis, RabbitMQ, Services).
   */
  getReadiness: async () => {
    try {
      const response = await apiClient.get('/health/ready');
      return response.data;
    } catch (err) {
      if (err.response?.data) {
        return err.response.data;
      }
      throw err;
    }
  },
};
