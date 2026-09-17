import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { notificationApi } from '../api/notificationApi.js';
import { notificationStorage } from '../utils/storage.js';

/**
 * Hook to retrieve user notifications with filtering and caching.
 * staleTime: 30000 (30 seconds).
 */
export const useNotifications = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      const res = await notificationApi.getNotifications(filters);
      const data = res?.data || res;

      let notifications = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        notifications = data;
      } else if (Array.isArray(data?.notifications)) {
        notifications = data.notifications;
        totalCount = data.totalCount || data.notifications.length;
      } else if (Array.isArray(data?.history)) {
        notifications = data.history;
        totalCount = data.history.length;
      }

      // Ensure each notification has standard fields and persistent read state
      const formatted = notifications.map((n, idx) => {
        const id = n.id || n._id || `notif-${idx}`;
        const ts = n.timestamp || n.createdAt || n.date || new Date().toISOString();
        const isRead = Boolean(n.read || n.status === 'READ' || n.isRead || notificationStorage.isRead(id, ts));

        return {
          id,
          type: (n.type || n.notificationType || 'SYSTEM').toUpperCase(),
          title: n.title || n.subject || n.payload?.subject || `${n.type || n.notificationType || 'Account'} Notification`,
          message: n.message || n.body || n.payload?.body || n.content || 'No details provided.',
          timestamp: ts,
          read: isRead,
          status: n.status || (isRead ? 'READ' : 'UNREAD'),
          channel: n.channel || n.notificationType || 'EMAIL',
        };
      });

      const unreadCount = formatted.filter((n) => !n.read).length;

      return {
        notifications: formatted,
        totalCount: totalCount || formatted.length,
        unreadCount,
      };
    },
    staleTime: 30000,
    ...options,
  });
};

/**
 * Hook to retrieve cursor-paginated notification audit history from notification service.
 * staleTime: 30000 (30 seconds).
 *
 * @param {Object} filters - Query filters (cursor, limit, status, type, startDate, endDate, recipient)
 * @param {Object} options - React Query options
 */
export const useNotificationHistory = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['notification-history', filters],
    queryFn: async () => {
      const res = await notificationApi.getNotificationHistory(filters);
      const data = res?.data || res;

      let items = [];
      let totalCount = 0;
      let nextCursor = null;
      let hasMore = false;

      if (Array.isArray(data)) {
        items = data;
        totalCount = items.length;
      } else if (Array.isArray(data?.notifications)) {
        items = data.notifications;
        totalCount = data?.pagination?.totalCount || items.length;
        nextCursor = data?.pagination?.nextCursor || null;
        hasMore = data?.pagination?.hasMore || Boolean(nextCursor);
      } else if (Array.isArray(data?.history)) {
        items = data.history;
        totalCount = data?.pagination?.totalCount || items.length;
        nextCursor = data?.pagination?.nextCursor || null;
        hasMore = data?.pagination?.hasMore || Boolean(nextCursor);
      }

      // Format notification history records with full channel, error metadata, and persistent read state
      const formatted = items.map((item, idx) => {
        const payload = item.payload || {};
        const channel = (item.notificationType || item.channel || 'EMAIL').toUpperCase();
        const status = (item.status || 'SENT').toUpperCase();
        const id = item.id || `notif-hist-${idx}`;
        const ts = item.createdAt || item.processedAt || new Date().toISOString();
        const isRead = Boolean(item.read || item.isRead || item.status === 'READ' || notificationStorage.isRead(id, ts));

        const title =
          item.title ||
          payload.subject ||
          (channel === 'SMS' ? 'SMS Alert' : 'Account Notification');

        const message =
          item.message ||
          payload.body ||
          payload.message ||
          `Notification event processed for transaction ${item.transactionId || 'N/A'}.`;

        return {
          id,
          eventId: item.eventId || null,
          transactionId: item.transactionId || payload.transactionId || null,
          referenceId: payload.referenceId || item.referenceId || null,
          channel, // EMAIL, SMS, PUSH, IN_APP
          type: (item.type || payload.eventType || channel).toUpperCase(),
          recipient: item.recipient || payload.recipient || 'customer@vaultcore.io',
          status, // SENT, PENDING, FAILED, DELIVERED
          retryCount: Number(item.retryCount || 0),
          errorMessage: item.errorMessage || null,
          title,
          message,
          amount: payload.amount !== undefined ? Number(payload.amount) : null,
          currency: payload.currency || 'USD',
          payload,
          timestamp: ts,
          processedAt: item.processedAt || item.createdAt,
          read: isRead,
        };
      });

      return {
        notifications: formatted,
        pagination: {
          limit: filters.limit || 20,
          totalCount,
          hasMore,
          nextCursor,
        },
      };
    },
    staleTime: 30000,
    ...options,
  });
};

/**
 * Hook to calculate unread notification count.
 */
export const useUnreadCount = (options = {}) => {
  const query = useNotifications({}, { staleTime: 30000, ...options });
  return {
    unreadCount: query.data?.unreadCount || 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

/**
 * Mutation hook to mark a single notification as read.
 */
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId) => {
      const res = await notificationApi.markAsRead(notificationId);
      return res;
    },
    onSuccess: (data, notificationId) => {
      notificationStorage.markAsRead(notificationId);
      toast.success('Notification marked as read.');

      // Optimistically update notifications cache
      queryClient.setQueriesData({ queryKey: ['notifications'] }, (oldData) => {
        if (!oldData?.notifications) return oldData;
        const updated = oldData.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true, status: 'READ' } : n
        );
        const unreadCount = updated.filter((n) => !n.read).length;
        return { ...oldData, notifications: updated, unreadCount };
      });

      // Optimistically update notification-history cache
      queryClient.setQueriesData({ queryKey: ['notification-history'] }, (oldData) => {
        if (!oldData?.notifications) return oldData;
        const updated = oldData.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        );
        return { ...oldData, notifications: updated };
      });

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-history'] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to mark notification as read.';
      toast.error(message);
    },
  });
};

/**
 * Mutation hook to mark all notifications as read.
 */
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds = []) => {
      const res = await notificationApi.markAllAsRead(notificationIds);
      return res;
    },
    onSuccess: (data, notificationIds) => {
      notificationStorage.markAllAsRead(Array.isArray(notificationIds) ? notificationIds : []);
      toast.success('All notifications marked as read.');

      // Optimistically update notifications cache
      queryClient.setQueriesData({ queryKey: ['notifications'] }, (oldData) => {
        if (!oldData?.notifications) return oldData;
        const updated = oldData.notifications.map((n) => ({ ...n, read: true, status: 'READ' }));
        return { ...oldData, notifications: updated, unreadCount: 0 };
      });

      // Optimistically update notification-history cache
      queryClient.setQueriesData({ queryKey: ['notification-history'] }, (oldData) => {
        if (!oldData?.notifications) return oldData;
        const updated = oldData.notifications.map((n) => ({ ...n, read: true }));
        return { ...oldData, notifications: updated };
      });

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-history'] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to mark all as read.';
      toast.error(message);
    },
  });
};
