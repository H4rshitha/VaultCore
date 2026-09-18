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
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';
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
  Search,
  Users,
  Building2,
  Landmark,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Check,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { connected } = useRealtimeEvents();
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toLocaleTimeString());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [copiedAccount, setCopiedAccount] = useState(null);

  const isStaff = currentUser?.role === 'TELLER' || currentUser?.role === 'ADMIN';

  // Auto-refresh accounts every 30 seconds on Dashboard
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useAccounts(
    { limit: 50, search: searchQuery },
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
  const stats = data?.stats || null;
  const firstName = currentUser?.firstName || currentUser?.email?.split('@')[0] || 'Member';

  // Filter accounts by type if selected
  const filteredAccounts = accounts.filter((acc) => {
    if (filterType === 'ALL') return true;
    return acc.type === filterType;
  });

  const handleCopy = (accNum) => {
    navigator.clipboard.writeText(accNum);
    setCopiedAccount(accNum);
    toast.success(`Account ${accNum} copied!`);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

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
              {isStaff ? <Building2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isStaff ? 'Branch Operations Console' : 'VaultCore Banking Portal'}</span>
            </div>
            {isStaff && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-500 uppercase">
                {currentUser?.role}
              </span>
            )}
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
            {isStaff
              ? 'Branch-wide customer directory, real-time deposit metrics, and counter operations.'
              : 'Real-time financial overview and active deposit accounts. Auto-refreshes every 30s.'}
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
            <span>{isStaff ? 'Open Customer Account' : 'Open Account'}</span>
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
          <Button variant="outline" size="sm" onClick={handleRetry} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* 3. Metrics Summary Section */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isStaff ? (
        /* Teller / Branch Operations Metrics */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Customer Accounts */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Managed Customer Accounts
              </span>
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {stats?.totalAccounts !== undefined ? stats.totalAccounts : accounts.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Active Portfolios</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full Double-Entry Ledger Backed</span>
            </div>
          </div>

          {/* Total Branch Deposit Holdings */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Customer Deposits
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Landmark className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(
                  stats?.totalDeposits !== undefined
                    ? stats.totalDeposits
                    : accounts.reduce((acc, a) => acc + Number(a.balance || 0), 0),
                  'USD'
                )}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Aggregate Branch Holdings (USD)</span>
            </div>
          </div>

          {/* Branch System Status */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Core Cluster Telemetry
              </span>
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Radio className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping"></span>
                Operational
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>PostgreSQL • Redis • RabbitMQ</span>
            </div>
          </div>
        </div>
      ) : (
        /* Customer Balance Summary */
        <BalanceSummaryCard accounts={accounts} />
      )}

      {/* 4. Teller Quick Action Ribbon */}
      {isStaff ? (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-brand-900/20 via-slate-900/40 to-slate-900/20 border border-brand-500/20 shadow-sm backdrop-blur-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-400 block mb-3">
            ⚡ Teller Counter Actions
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-brand-400 mb-1.5" />
              <div className="text-xs font-bold text-white">Open Account</div>
              <div className="text-[10px] text-slate-400">Onboard customer</div>
            </button>

            <button
              onClick={() => navigate('/transfer?mode=deposit')}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4 text-emerald-400 mb-1.5" />
              <div className="text-xs font-bold text-white">Cash Deposit</div>
              <div className="text-[10px] text-slate-400">Credit customer account</div>
            </button>

            <button
              onClick={() => navigate('/transfer?mode=withdraw')}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer"
            >
              <ArrowUpFromLine className="w-4 h-4 text-amber-400 mb-1.5" />
              <div className="text-xs font-bold text-white">Cash Withdrawal</div>
              <div className="text-[10px] text-slate-400">Debit customer account</div>
            </button>

            <button
              onClick={() => navigate('/transfer?mode=transfer')}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4 text-purple-400 mb-1.5" />
              <div className="text-xs font-bold text-white">Transfer Funds</div>
              <div className="text-[10px] text-slate-400">Inter-account transfer</div>
            </button>
          </div>
        </div>
      ) : (
        /* Customer Quick Actions */
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div
              onClick={() => navigate('/transfer')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-brand-500/30 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Transfer Money
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Instant ACID payment</span>
            </div>

            <div
              onClick={() => navigate('/accounts')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-brand-500/30 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                View Accounts
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Manage all portfolios</span>
            </div>

            <div
              onClick={() => navigate('/transactions')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-brand-500/30 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ReceiptText className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Transactions
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">History & audit logs</span>
            </div>

            <div
              onClick={() => navigate('/notifications')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-brand-500/30 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Notifications
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Email & SMS alerts</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Accounts Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isStaff ? 'Customer Accounts Directory' : 'Recent Accounts'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isStaff
                ? `Showing ${filteredAccounts.length} accounts across active branch customers`
                : 'Your most active bank accounts'}
            </p>
          </div>

          {/* Filter & Search Bar for Tellers */}
          {isStaff && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, account..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800 text-[11px] font-medium">
                {['ALL', 'CHECKING', 'SAVINGS', 'INVESTMENT'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      filterType === t
                        ? 'bg-brand-600 text-white font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800">
            <Wallet className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              No Bank Accounts Found
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {isStaff
                ? 'No customer accounts match your filter or search query. Click "Open Customer Account" to provision a new account.'
                : "You haven't opened any bank accounts yet. Create your first checking or savings account to start transacting."}
            </p>
            <div className="mt-4">
              <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                {isStaff ? 'Open Customer Account' : 'Open First Account'}
              </Button>
            </div>
          </div>
        ) : isStaff ? (
          /* Teller Customer Accounts Table View */
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Account Number</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4 text-right">Counter Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredAccounts.map((account) => {
                  const customerName = account.user
                    ? `${account.user.firstName || ''} ${account.user.lastName || ''}`.trim() ||
                      account.user.email
                    : 'Customer';
                  const customerEmail = account.user?.email || '';

                  return (
                    <tr
                      key={account.id || account.accountNumber}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Customer Info */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {customerName}
                        </div>
                        {customerEmail && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            {customerEmail}
                          </div>
                        )}
                      </td>

                      {/* Account Number */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <span>{account.accountNumber}</span>
                          <button
                            onClick={() => handleCopy(account.accountNumber)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Copy Account Number"
                          >
                            {copiedAccount === account.accountNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            account.type === 'CHECKING'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : account.type === 'SAVINGS'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {account.type}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            account.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              account.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          ></span>
                          {account.status}
                        </span>
                      </td>

                      {/* Balance */}
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-mono text-sm">
                        {formatCurrency(account.balance, account.currency || 'USD')}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              navigate(`/transfer?mode=deposit&acc=${account.accountNumber}`)
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/20 transition-all cursor-pointer"
                            title="Deposit Cash into Account"
                          >
                            Deposit
                          </button>
                          <button
                            onClick={() =>
                              navigate(`/transfer?mode=withdraw&acc=${account.accountNumber}`)
                            }
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold text-[11px] border border-amber-500/20 transition-all cursor-pointer"
                            title="Withdraw Cash from Account"
                          >
                            Withdraw
                          </button>
                          <button
                            onClick={() =>
                              navigate(`/transfer?mode=transfer&source=${account.accountNumber}`)
                            }
                            className="px-2.5 py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-semibold text-[11px] border border-brand-500/20 transition-all cursor-pointer"
                            title="Transfer from this Account"
                          >
                            Transfer
                          </button>
                          <button
                            onClick={() => navigate(`/ledger?acc=${account.accountNumber}`)}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] transition-all cursor-pointer"
                            title="View Ledger History"
                          >
                            Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Customer Card Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAccounts.map((account) => (
              <AccountCard key={account.id || account.accountNumber} account={account} />
            ))}
          </div>
        )}
      </div>

      {/* 6. Modal for Opening Accounts */}
      <CreateAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        isStaffMode={isStaff}
      />
    </div>
  );
};

export default DashboardPage;
