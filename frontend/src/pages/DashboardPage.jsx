import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useAccounts } from '../hooks/useAccounts.js';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents.js';
import { BalanceSummaryCard } from '../components/BalanceSummaryCard.jsx';
import { AccountCard } from '../components/AccountCard.jsx';
import { CreateAccountModal } from '../components/CreateAccountModal.jsx';
import { Button } from '../components/ui/Button.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { showSuccess, showError, showLoading, dismissToast } from '../utils/toast.js';
import {
  ArrowLeftRight,
  Wallet,
  ReceiptText,
  Bell,
  Plus,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Clock,
  Radio,
} from 'lucide-react';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { connected } = useRealtimeEvents();
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toLocaleTimeString());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Auto-refresh accounts every 30 seconds on Dashboard only
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useAccounts(
    { limit: 5 },
    {
      refetchInterval: 30000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    }
  );

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdated(new Date(dataUpdatedAt).toLocaleTimeString());
    }
  }, [dataUpdatedAt]);

  const accounts = data?.accounts || [];
  const firstName = currentUser?.firstName || currentUser?.email?.split('@')[0] || 'Member';

  const handleManualRefresh = async () => {
    const toastId = showLoading('Syncing accounts...');
    try {
      const res = await refetch();
      dismissToast(toastId);
      if (res.isError) {
        showError('Failed to sync accounts.');
      } else {
        showSuccess('Accounts synchronized successfully.');
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch {
      dismissToast(toastId);
      showError('Failed to sync accounts.');
    }
  };

  const handleRetry = async () => {
    const toastId = showLoading('Retrying connection...');
    try {
      const res = await refetch();
      dismissToast(toastId);
      if (res.isError) {
        showError('Retry failed. Please check network/server.');
      } else {
        showSuccess('Retry completed successfully.');
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch {
      dismissToast(toastId);
      showError('Retry failed.');
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Welcome Header & Quick Action Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>VaultCore Banking Portal</span>
            </div>
            {connected && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                <span>Live Stream Active</span>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Last updated: {lastUpdated}</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time financial overview and active deposit accounts. Auto-refreshes every 30s.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh All Accounts"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-500 dark:text-brand-400' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Open Account</span>
          </button>
        </div>
      </div>

      {/* 2. Error State */}
      {isError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                Unable to load accounts
              </p>
              <p className="text-xs text-red-600 dark:text-red-400/80">
                {error?.response?.data?.message ||
                  error?.message ||
                  'Network error communicating with Gateway'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Summary Stats Cards */}
      <BalanceSummaryCard accounts={accounts} isLoading={isLoading} />

      {/* 4. Quick Actions Hub */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Action 1: Money Transfer */}
          <button
            onClick={() => navigate('/transfer')}
            className="group p-4 rounded-2xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 shadow-sm dark:shadow-md transition-all text-left flex flex-col justify-between h-28 cursor-pointer"
          >
            <div className="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Transfer Money
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Instant ACID payment
              </span>
            </div>
          </button>

          {/* Action 2: View Accounts */}
          <button
            onClick={() => navigate('/accounts')}
            className="group p-4 rounded-2xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 shadow-sm dark:shadow-md transition-all text-left flex flex-col justify-between h-28 cursor-pointer"
          >
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                View Accounts
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage all portfolios
              </span>
            </div>
          </button>

          {/* Action 3: Transactions */}
          <button
            onClick={() => navigate('/transactions')}
            className="group p-4 rounded-2xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 shadow-sm dark:shadow-md transition-all text-left flex flex-col justify-between h-28 cursor-pointer"
          >
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Transactions
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                History & audit logs
              </span>
            </div>
          </button>

          {/* Action 4: Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className="group p-4 rounded-2xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 shadow-sm dark:shadow-md transition-all text-left flex flex-col justify-between h-28 cursor-pointer"
          >
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Notifications
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Email & SMS alerts
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 5. Recent Accounts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Accounts</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your most active bank accounts
            </p>
          </div>
          {accounts.length > 0 && (
            <button
              onClick={() => navigate('/accounts')}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 flex items-center gap-1 transition-colors cursor-pointer"
            >
              View All ({accounts.length}) <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} rows={2} />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 shadow-sm text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mb-3">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              No Bank Accounts Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
              You haven't opened any bank accounts yet. Create your first Checking or Savings
              account to begin transferring funds.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Open Your First Account</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.slice(0, 3).map((account) => (
              <AccountCard
                key={account.accountNumber || account.id}
                account={account}
                onSelect={() => navigate('/accounts')}
              />
            ))}
          </div>
        )}
      </div>

      {/* 6. Create Account Modal */}
      <CreateAccountModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
};
