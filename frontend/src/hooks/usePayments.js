import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { paymentApi } from '../api/paymentApi.js';

/**
 * Hook to execute money transfers between bank accounts.
 * Provides toast lifecycle notifications and invalidates accounts & transactions cache.
 */
export const useTransferMoney = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferData) => {
      const res = await paymentApi.transfer(transferData);
      return res?.data || res;
    },
    onMutate: () => {
      const toastId = toast.loading('Processing instant transfer...');
      return { toastId };
    },
    onSuccess: (data, variables, context) => {
      if (context?.toastId) {
        toast.success('Transfer completed successfully!', { id: context.toastId });
      } else {
        toast.success('Transfer completed successfully!');
      }

      // Invalidate relevant caches to trigger immediate balance and history refetches
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] });
    },
    onError: (error, variables, context) => {
      const errData = error.response?.data;
      const message =
        errData?.error?.message ||
        errData?.message ||
        (typeof errData?.error === 'string' ? errData.error : null) ||
        error.message ||
        'Transfer failed. Please check account details and available balance.';

      if (context?.toastId) {
        toast.error(message, { id: context.toastId });
      } else {
        toast.error(message);
      }
    },
  });
};

/**
 * Hook to fetch filtered transaction history.
 * Cached with staleTime: 30000 (30 seconds).
 */
export const useTransactions = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const res = await paymentApi.getPaymentHistory(filters);
      const data = res?.data || res;

      let payments = [];
      let nextCursor = null;
      let previousCursor = null;
      let totalCount = 0;

      if (Array.isArray(data)) {
        payments = data;
      } else if (Array.isArray(data?.payments)) {
        payments = data.payments;
        nextCursor = data.nextCursor || data.pagination?.nextCursor || null;
        previousCursor = data.previousCursor || data.pagination?.previousCursor || null;
        totalCount = data.totalCount || data.pagination?.totalCount || data.payments.length;
      } else if (Array.isArray(data?.transactions)) {
        payments = data.transactions;
        nextCursor = data.nextCursor || data.pagination?.nextCursor || null;
        previousCursor = data.previousCursor || data.pagination?.previousCursor || null;
        totalCount = data.totalCount || data.pagination?.totalCount || data.transactions.length;
      }

      return {
        payments,
        transactions: payments,
        nextCursor,
        previousCursor,
        pagination: {
          nextCursor,
          previousCursor,
          totalCount,
        },
        totalCount,
      };
    },
    staleTime: 30000,
    ...options,
  });
};

/**
 * Hook to retrieve financial payment summary metrics.
 */
export const usePaymentSummary = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ['payment-summary', params],
    queryFn: async () => {
      const res = await paymentApi.getPaymentSummary(params);
      return res?.data || res;
    },
    staleTime: 30000,
    ...options,
  });
};
