import { apiClient } from './client.js';

export const accountApi = {
  /**
   * Fetch paginated list of accounts owned by the authenticated customer.
   * @param {Object} params - Query params: { page, limit }
   */
  getAccounts: async (params = {}) => {
    const response = await apiClient.get('/accounts', { params });
    return response.data;
  },

  /**
   * Open a new bank account for the authenticated user.
   * @param {Object} data - { type, currency, initialDeposit }
   */
  createAccount: async (data) => {
    let normalizedType = (data.type || 'CHECKING').toUpperCase();
    if (normalizedType === 'CURRENT' || normalizedType === 'BUSINESS') {
      normalizedType = 'CHECKING';
    }

    const payload = {
      type: normalizedType,
      currency: (data.currency || 'USD').toUpperCase(),
      initialDeposit:
        typeof data.initialDeposit === 'number'
          ? data.initialDeposit
          : parseFloat(data.initialDeposit) || 0,
      ...(data.customerId ? { customerId: data.customerId } : {}),
    };

    const response = await apiClient.post('/accounts', payload);
    return response.data;
  },

  /**
   * Teller/Admin lookup to search customers by name, email, phone, or customerId.
   * @param {Object} params - { customerId, email, phone, name, query }
   */
  searchCustomers: async (params = {}) => {
    const response = await apiClient.get('/customers/search', { params });
    return response.data;
  },

  /**
   * Teller/Admin lookup to get customer details by ID.
   * @param {string} customerId
   */
  getCustomer: async (customerId) => {
    const response = await apiClient.get(`/customers/${customerId}`);
    return response.data;
  },

  /**
   * Retrieve full details of a specific bank account.
   * @param {string} accountNumber - 12-digit account number.
   */
  getAccount: async (accountNumber) => {
    const response = await apiClient.get(`/accounts/${accountNumber}`);
    return response.data;
  },

  /**
   * Fetch current balance and status for a specific bank account.
   * @param {string} accountNumber - 12-digit account number.
   */
  getAccountBalance: async (accountNumber) => {
    const response = await apiClient.get(`/accounts/${accountNumber}/balance`);
    return response.data;
  },
};
