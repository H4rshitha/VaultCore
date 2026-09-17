import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.js';
import { EventStreamClient } from '../api/eventsApi.js';
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';

const RealtimeContext = createContext(null);

export const RealtimeProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [connectionStatus, setConnectionStatus] = useState('OFFLINE');
  const [lastEvent, setLastEvent] = useState(null);

  const clientRef = useRef(null);
  const processedEventIdsRef = useRef(new Set());
  const prevStatusRef = useRef('OFFLINE');

  // Balance Update Batching Buffer
  const balanceUpdateBatchRef = useRef(new Map());
  const balanceUpdateTimerRef = useRef(null);

  // Helper to deduplicate incoming events
  const isDuplicateEvent = useCallback((event) => {
    const key =
      event.eventId ||
      event.referenceId ||
      event.id ||
      (event.type && event.timestamp ? `${event.type}-${event.timestamp}` : null);

    if (!key) return false;
    if (processedEventIdsRef.current.has(key)) return true;

    processedEventIdsRef.current.add(key);
    // Keep set bounded to last 500 events
    if (processedEventIdsRef.current.size > 500) {
      const first = processedEventIdsRef.current.values().next().value;
      processedEventIdsRef.current.delete(first);
    }
    return false;
  }, []);

  // Flush batched balance update toasts
  const flushBalanceUpdates = useCallback(() => {
    if (balanceUpdateBatchRef.current.size === 0) return;

    const updates = Array.from(balanceUpdateBatchRef.current.values());
    balanceUpdateBatchRef.current.clear();

    if (updates.length === 1) {
      const { accountNumber, balance, currency } = updates[0];
      toast(`💰 Balance updated for ${maskAccountNumber(accountNumber)}: ${formatCurrency(balance, currency)}`, {
        icon: '💳',
        duration: 4000,
      });
    } else {
      toast(`💰 ${updates.length} account balances updated in real time.`, {
        icon: '💳',
        duration: 4000,
      });
    }
  }, []);

  // Main Event Dispatcher & Query Cache Updater
  const handleIncomingEvent = useCallback(
    (event) => {
      if (!event || !event.type) return;
      if (isDuplicateEvent(event)) return;

      setLastEvent(event);
      const eventType = String(event.type).toLowerCase();

      switch (eventType) {
        // 1. Notification Created
        case 'notification.created': {
          const payload = event.payload || event;
          const newNotif = {
            id: payload.id || `notif-${Date.now()}`,
            type: (payload.type || payload.notificationType || 'TRANSACTION').toUpperCase(),
            title: payload.title || payload.subject || 'New Notification',
            message: payload.message || payload.body || 'You have received a new banking alert.',
            timestamp: payload.timestamp || payload.createdAt || new Date().toISOString(),
            read: false,
            status: 'UNREAD',
            channel: (payload.channel || payload.notificationType || 'EMAIL').toUpperCase(),
          };

          // Optimistically update notifications cache
          queryClient.setQueriesData({ queryKey: ['notifications'] }, (old) => {
            if (!old) return { notifications: [newNotif], totalCount: 1, unreadCount: 1 };
            const existing = old.notifications || [];
            return {
              ...old,
              notifications: [newNotif, ...existing],
              totalCount: (old.totalCount || existing.length) + 1,
              unreadCount: (old.unreadCount || 0) + 1,
            };
          });

          // Optimistically update notification-history cache
          queryClient.setQueriesData({ queryKey: ['notification-history'] }, (old) => {
            if (!old) return old;
            const existing = old.notifications || [];
            return {
              ...old,
              notifications: [newNotif, ...existing],
              pagination: {
                ...old.pagination,
                totalCount: (old.pagination?.totalCount || existing.length) + 1,
              },
            };
          });

          // Suppress toast if user is already looking at /notifications page
          const isOnNotificationsPage =
            typeof window !== 'undefined' && window.location.pathname.startsWith('/notifications');

          if (!isOnNotificationsPage) {
            toast(`🔔 ${newNotif.title}: ${newNotif.message}`, {
              duration: 5000,
              icon: '📩',
            });
          }
          break;
        }

        // 2. Payment Completed
        case 'payment.completed': {
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          queryClient.invalidateQueries({ queryKey: ['account-balance'] });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['payment-history'] });
          queryClient.invalidateQueries({ queryKey: ['payment-summary'] });
          queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });

          const amt = event.amount ? formatCurrency(event.amount, event.currency || 'USD') : 'Transfer';
          const ref = event.referenceId ? ` (Ref: ${event.referenceId})` : '';
          toast.success(`Payment Completed: ${amt}${ref}`, { duration: 4500 });
          break;
        }

        // 3. Payment Failed
        case 'payment.failed': {
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['payment-history'] });
          queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });

          const reason = event.reason || event.message || 'Verification or funds error';
          toast.error(`Transfer Failed: ${reason}`, { duration: 5000 });
          break;
        }

        // 4. Account Balance Updated (Batched)
        case 'account.balance.updated': {
          const { accountNumber, balance, currency = 'USD' } = event;

          if (accountNumber && balance !== undefined) {
            const numBal = Number(balance);

            // Update individual account balance cache immediately
            queryClient.setQueriesData({ queryKey: ['account-balance', accountNumber] }, (old) => {
              if (!old) return { accountNumber, balance: numBal, currency, status: 'ACTIVE' };
              return { ...old, balance: numBal };
            });

            // Update accounts list cache immediately
            queryClient.setQueriesData({ queryKey: ['accounts'] }, (old) => {
              if (!old?.accounts) return old;
              const updatedAccounts = old.accounts.map((acc) =>
                acc.accountNumber === accountNumber ? { ...acc, balance: numBal } : acc
              );
              return { ...old, accounts: updatedAccounts };
            });

            // Queue for batched toast notification (300ms debounce)
            balanceUpdateBatchRef.current.set(accountNumber, { accountNumber, balance: numBal, currency });

            if (balanceUpdateTimerRef.current) {
              clearTimeout(balanceUpdateTimerRef.current);
            }
            balanceUpdateTimerRef.current = setTimeout(flushBalanceUpdates, 300);
          }

          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          break;
        }

        // 5. Ledger Entry Created
        case 'ledger.entry.created': {
          const { accountNumber, entry } = event;

          if (accountNumber && entry) {
            queryClient.setQueriesData({ queryKey: ['ledger-entries', accountNumber] }, (old) => {
              if (!old?.entries) return old;
              return {
                ...old,
                entries: [entry, ...old.entries],
              };
            });
          }

          queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
          break;
        }

        // 6. Circuit Breaker State Changed
        case 'circuit-breaker.state.changed': {
          queryClient.invalidateQueries({ queryKey: ['circuit-breakers'] });
          queryClient.invalidateQueries({ queryKey: ['admin-circuit-breakers'] });
          queryClient.invalidateQueries({ queryKey: ['admin-telemetry'] });

          const svc = event.service || 'Downstream Service';
          const st = event.state || 'CHANGED';
          toast(`⚡ Circuit Breaker [${svc}] state: ${st}`, {
            icon: '🛡️',
            duration: 4000,
          });
          break;
        }

        // 7. Connection Restored Event
        case 'connection.restored': {
          toast.success('Real-time banking connection restored.', { id: 'sse-status' });
          break;
        }

        default:
          break;
      }
    },
    [isDuplicateEvent, queryClient, flushBalanceUpdates]
  );

  // Status Change Handler
  const handleStatusChange = useCallback((status) => {
    setConnectionStatus(status);

    if (prevStatusRef.current === 'CONNECTED' && status === 'RECONNECTING') {
      toast('Connection lost. Reconnecting in real time...', {
        id: 'sse-status',
        icon: '🔄',
        duration: 3000,
      });
    }

    prevStatusRef.current = status;
  }, []);

  // Initialize and clean up SSE client lifecycle
  useEffect(() => {
    if (!isAuthenticated) {
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
      // Full logout cleanup: clear deduplication cache, pending buffers, and reset state
      processedEventIdsRef.current.clear();
      balanceUpdateBatchRef.current.clear();
      if (balanceUpdateTimerRef.current) {
        clearTimeout(balanceUpdateTimerRef.current);
        balanceUpdateTimerRef.current = null;
      }
      setLastEvent(null);
      setConnectionStatus('OFFLINE');
      return;
    }

    const client = new EventStreamClient({
      onEvent: handleIncomingEvent,
      onStatusChange: handleStatusChange,
      onError: () => {},
    });

    clientRef.current = client;
    client.connect();

    // Page Visibility Optimization: Pause on tab hide, reconnect on tab visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden: pause SSE connection
        if (clientRef.current) {
          clientRef.current.close();
          setConnectionStatus('OFFLINE');
        }
      } else {
        // Tab visible: reconnect if authenticated
        if (isAuthenticated && clientRef.current) {
          clientRef.current.connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
      if (balanceUpdateTimerRef.current) {
        clearTimeout(balanceUpdateTimerRef.current);
      }
    };
  }, [isAuthenticated, handleIncomingEvent, handleStatusChange]);

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.reconnect();
    }
  }, []);

  const value = {
    connected: connectionStatus === 'CONNECTED',
    connectionStatus,
    lastEvent,
    reconnect,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    return {
      connected: false,
      connectionStatus: 'OFFLINE',
      lastEvent: null,
      reconnect: () => {},
    };
  }
  return context;
};
