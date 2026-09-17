import { apiClient } from './client.js';

export const ledgerApi = {
  /**
   * Fetch cursor-paginated ledger entries and audit history for a specific account.
   *
   * @param {string} accountNumber - 12-digit account number
   * @param {Object} params - Query filters (cursor, limit, type, startDate, endDate, referenceId)
   */
  getAccountLedgerEntries: async (accountNumber, params = {}) => {
    if (!accountNumber) {
      throw new Error('Account number is required to fetch ledger entries');
    }

    const cleanParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
        cleanParams[key] = value;
      }
    }

    const response = await apiClient.get(`/ledger/accounts/${accountNumber}/entries`, {
      params: cleanParams,
    });
    return response.data;
  },
};
