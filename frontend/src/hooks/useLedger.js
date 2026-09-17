import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '../api/ledgerApi.js';

/**
 * Hook to retrieve double-entry ledger statement entries for a specific account.
 * Caches each (accountNumber, filters) combination separately with staleTime: 30000 (30 seconds).
 *
 * @param {string} accountNumber - 12-digit account number
 * @param {Object} filters - Query filters (cursor, limit, type, startDate, endDate, referenceId)
 * @param {Object} options - Additional React Query options
 */
export const useLedgerEntries = (accountNumber, filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['ledger-entries', accountNumber, filters],
    queryFn: async () => {
      if (!accountNumber) {
        return {
          accountNumber: '',
          currency: 'USD',
          entries: [],
          pagination: { limit: 20, nextCursor: null },
        };
      }

      const res = await ledgerApi.getAccountLedgerEntries(accountNumber, filters);
      const data = res?.data || res;

      let entries = [];
      let nextCursor = null;
      let currency = data?.currency || 'USD';
      let limit = data?.pagination?.limit || filters.limit || 20;

      if (Array.isArray(data)) {
        entries = data;
      } else if (Array.isArray(data?.entries)) {
        entries = data.entries;
        nextCursor = data?.pagination?.nextCursor || null;
      } else if (Array.isArray(data?.ledgerEntries)) {
        entries = data.ledgerEntries;
        nextCursor = data?.pagination?.nextCursor || null;
      }

      // Format entries with standard schema
      const formattedEntries = entries.map((entry, idx) => ({
        id: entry.id || `entry-${idx}`,
        transactionId: entry.transactionId,
        accountId: entry.accountId,
        type: (entry.type || 'DEBIT').toUpperCase(), // 'DEBIT' or 'CREDIT'
        amount: Number(entry.amount || 0),
        balanceAfter: Number(entry.balanceAfter || 0),
        createdAt: entry.createdAt || new Date().toISOString(),
        transaction: {
          id: entry.transaction?.id || entry.transactionId,
          referenceId: entry.transaction?.referenceId || entry.referenceId || 'N/A',
          type: (entry.transaction?.type || 'TRANSFER').toUpperCase(),
          status: (entry.transaction?.status || 'COMPLETED').toUpperCase(),
          description: entry.transaction?.description || entry.description || 'Ledger transaction',
          createdAt: entry.transaction?.createdAt || entry.createdAt,
        },
      }));

      return {
        accountNumber: data?.accountNumber || accountNumber,
        currency,
        entries: formattedEntries,
        pagination: {
          limit,
          nextCursor,
        },
      };
    },
    staleTime: 30000,
    enabled: Boolean(accountNumber),
    ...options,
  });
};
