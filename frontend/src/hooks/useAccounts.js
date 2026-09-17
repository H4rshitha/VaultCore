import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountApi } from '../api/accountApi.js';

/**
 * Hook to retrieve the list of accounts owned by the authenticated customer.
 * Caches with staleTime: 60000 (1 minute).
 * Supports polling via options (e.g. refetchInterval: 30000).
 */
export const useAccounts = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ['accounts', params],
    queryFn: async () => {
      const res = await accountApi.getAccounts(params);
      const data = res?.data || res;
      // Handle both structured { accounts: [], pagination: {} } and direct array
      const accounts = Array.isArray(data?.accounts) ? data.accounts : Array.isArray(data) ? data : [];
      const pagination = data?.pagination || { page: 1, limit: 10, totalCount: accounts.length, totalPages: 1 };
      return { accounts, pagination };
    },
    staleTime: 60000,
    ...options,
  });
};

/**
 * Hook to fetch detailed information for a single account.
 */
export const useAccount = (accountNumber, options = {}) => {
  return useQuery({
    queryKey: ['account', accountNumber],
    queryFn: async () => {
      const res = await accountApi.getAccount(accountNumber);
      return res?.data || res;
    },
    staleTime: 60000,
    enabled: Boolean(accountNumber),
    ...options,
  });
};

/**
 * Hook to fetch real-time balance for an account with Cache-Aside support.
 */
export const useAccountBalance = (accountNumber, options = {}) => {
  return useQuery({
    queryKey: ['account-balance', accountNumber],
    queryFn: async () => {
      const res = await accountApi.getAccountBalance(accountNumber);
      return res?.data || res;
    },
    staleTime: 30000,
    enabled: Boolean(accountNumber),
    ...options,
  });
};

/**
 * Hook for Teller/Admin customer lookup and search.
 * Caches search results for 60 seconds (staleTime: 60000).
 * Supports search by customerId, email, phone, or name.
 */
export const useCustomerSearch = (query = '', options = {}) => {
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';

  return useQuery({
    queryKey: ['customer-search', trimmedQuery],
    queryFn: async () => {
      if (!trimmedQuery) return [];
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedQuery);
      const params = isUUID
        ? { customerId: trimmedQuery, query: trimmedQuery }
        : trimmedQuery.includes('@')
          ? { email: trimmedQuery, query: trimmedQuery }
          : /^\+?[0-9\s-()]+$/.test(trimmedQuery) && trimmedQuery.length >= 7
            ? { phone: trimmedQuery, query: trimmedQuery }
            : { name: trimmedQuery, query: trimmedQuery };

      const res = await accountApi.searchCustomers(params);
      const data = res?.data || res;
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60000,
    enabled: Boolean(trimmedQuery && trimmedQuery.length >= 1),
    ...options,
  });
};

/**
 * Mutation hook to create a new bank account.
 * Automatically invalidates accounts cache and customer's account cache upon completion,
 * and triggers global toast lifecycle notifications.
 */
export const useCreateAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountData) => {
      const res = await accountApi.createAccount(accountData);
      return {
        ...(res?.data || res),
        _targetCustomerName: accountData._customerName || null,
        _targetCustomerId: accountData.customerId || null,
      };
    },
    onMutate: () => {
      const toastId = toast.loading('Creating new account...');
      return { toastId };
    },
    onSuccess: (newAccount, variables, context) => {
      const targetName = variables._customerName || newAccount._targetCustomerName;
      const successMsg = targetName
        ? `Account created successfully for ${targetName}.`
        : 'Account created successfully!';

      if (context?.toastId) {
        toast.success(successMsg, { id: context.toastId });
      } else {
        toast.success(successMsg);
      }

      // Invalidate accounts cache to refetch updated list
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['customer-search'] });
      if (variables?.customerId) {
        queryClient.invalidateQueries({ queryKey: ['accounts', { userId: variables.customerId }] });
      }

      // Optimistically set the newly created account in cache
      if (newAccount?.accountNumber) {
        queryClient.setQueryData(['account', newAccount.accountNumber], newAccount);
      }
    },
    onError: (error, variables, context) => {
      const errData = error.response?.data;
      const message =
        errData?.error?.message ||
        errData?.message ||
        (typeof errData?.error === 'string' ? errData.error : null) ||
        error.message ||
        'Failed to create account.';
      if (context?.toastId) {
        toast.error(message, { id: context.toastId });
      } else {
        toast.error(message);
      }
    },
  });
};
