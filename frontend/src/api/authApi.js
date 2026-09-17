import { apiClient } from './client.js';

export const authApi = {
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  signup: async (userData) => {
    const response = await apiClient.post('/auth/signup', userData);
    return response.data;
  },

  refreshToken: async (refreshToken) => {
    const payload = refreshToken ? { refreshToken } : {};
    const response = await apiClient.post('/auth/refresh', payload);
    return response.data;
  },

  logout: async (refreshToken) => {
    try {
      const payload = refreshToken ? { refreshToken } : {};
      const response = await apiClient.post('/auth/logout', payload);
      return response.data;
    } catch {
      return { success: true };
    }
  },

  getProfile: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};
