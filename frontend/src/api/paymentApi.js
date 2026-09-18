import { apiClient } from './client.js';

/**
 * Generates a standard UUID v4 for idempotency keys.
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const paymentApi = {
  /**
   * Execute an ACID money transfer between two bank accounts.
   *
   * @param {Object} data - Transfer payload
   * @param {string} data.sourceAccountNumber - 12-digit source account
   * @param {string} data.targetAccountNumber - 12-digit destination account
   * @param {string} [data.destinationAccountNumber] - Alias for targetAccountNumber
   * @param {number} data.amount - Transfer amount (> 0)
   * @param {string} [data.currency] - 3-letter currency (e.g. USD)
   * @param {string} [data.description] - Optional note/memo
   * @param {string} [data.idempotencyKey] - Unique transfer UUID
   */
  transfer: async (data) => {
    const targetAccount = data.targetAccountNumber || data.destinationAccountNumber;
    const payload = {
      idempotencyKey: data.idempotencyKey || generateUUID(),
      sourceAccountNumber: String(data.sourceAccountNumber).trim(),
      targetAccountNumber: String(targetAccount).trim(),
      amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount),
      currency: (data.currency || 'USD').toUpperCase(),
      description: data.description ? String(data.description).trim() : undefined,
    };

    const response = await apiClient.post('/payments/transfer', payload);
    return response.data;
  },

  /**
   * Execute a Cash Deposit into an account.
   */
  deposit: async (data) => {
    const payload = {
      idempotencyKey: data.idempotencyKey || generateUUID(),
      accountNumber: String(data.accountNumber).trim(),
      amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount),
      currency: (data.currency || 'USD').toUpperCase(),
      description: data.description ? String(data.description).trim() : 'Cash Deposit',
    };

    const response = await apiClient.post('/payments/deposit', payload);
    return response.data;
  },

  /**
   * Execute a Cash Withdrawal from an account.
   */
  withdraw: async (data) => {
    const payload = {
      idempotencyKey: data.idempotencyKey || generateUUID(),
      accountNumber: String(data.accountNumber).trim(),
      amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount),
      currency: (data.currency || 'USD').toUpperCase(),
      description: data.description ? String(data.description).trim() : 'Cash Withdrawal',
    };

    const response = await apiClient.post('/payments/withdraw', payload);
    return response.data;
  },

  /**
   * Fetch paginated payment history with optional filtering.
   *
   * @param {Object} params - Query parameters (status, type, minAmount, maxAmount, startDate, endDate, cursor, limit)
   */
  getPaymentHistory: async (params = {}) => {
    // Clean up empty params
    const cleanParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
        cleanParams[key] = value;
      }
    }

    const response = await apiClient.get('/payments/history', { params: cleanParams });
    return response.data;
  },

  /**
   * Search payment transactions across reference IDs and account numbers.
   *
   * @param {Object} params - Query parameters
   */
  searchPayments: async (params = {}) => {
    const cleanParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
        cleanParams[key] = value;
      }
    }

    const response = await apiClient.get('/payments/search', { params: cleanParams });
    return response.data;
  },

  /**
   * Get payment summary statistics (total debit, credit, transaction counts).
   *
   * @param {Object} params - Query parameters (startDate, endDate, accountNumber, currency)
   */
  getPaymentSummary: async (params = {}) => {
    const response = await apiClient.get('/payments/summary', { params });
    return response.data;
  },

  /**
   * Fetch details for a specific payment reference.
   *
   * @param {string} referenceId - Payment reference ID
   */
  getPaymentByReference: async (referenceId) => {
    const response = await apiClient.get(`/payments/${referenceId}`);
    return response.data;
  },
};
