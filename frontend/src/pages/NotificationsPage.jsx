import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Check,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Mail,
  Smartphone,
  Layers,
  ChevronLeft,
  ChevronRight,
  Shield,
  Copy,
  Clock,
  RotateCw,
  Hash,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  useNotificationHistory,
  useMarkAsRead,
  useMarkAllAsRead,
} from '../hooks/useNotifications.js';
import { formatCurrency } from '../utils/currency.js';
import { showSuccess, showError, showLoading, dismissToast } from '../utils/toast.js';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Button } from '../components/ui/Button.jsx';

const CHANNEL_CONFIG = {
  EMAIL: {
    label: 'Email',
    icon: Mail,
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  SMS: {
    label: 'SMS',
    icon: Smartphone,
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  PUSH: {
    label: 'Push',
    icon: Bell,
    badgeClass: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  },
  IN_APP: {
    label: 'In-App',
    icon: Layers,
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
};

const STATUS_CONFIG = {
  SENT: {
    label: 'Sent',
    chipClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-400',
  },
  DELIVERED: {
    label: 'Delivered',
    chipClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dotClass: 'bg-blue-400',
  },
  PENDING: {
    label: 'Pending',
    chipClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  FAILED: {
    label: 'Failed',
    chipClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dotClass: 'bg-rose-400',
  },
};

export const NotificationsPage = () => {
  // 1. Filter States
  const [readFilter, setReadFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'
  const [channelFilter, setChannelFilter] = useState('ALL'); // 'ALL' | 'EMAIL' | 'SMS'
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('ALL'); // 'ALL' | 'SENT' | 'PENDING' | 'FAILED'
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 2. Cursor Pagination Stack
  const [cursorHistory, setCursorHistory] = useState([null]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const currentCursor = cursorHistory[currentPageIndex];

  // Build query filters for API
  const apiFilters = {
    limit: 15,
    ...(currentCursor ? { cursor: currentCursor } : {}),
    ...(channelFilter !== 'ALL' ? { type: channelFilter } : {}),
    ...(deliveryStatusFilter !== 'ALL' ? { status: deliveryStatusFilter } : {}),
    ...(startDate ? { startDate: new Date(startDate).toISOString() } : {}),
    ...(endDate ? { endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString() } : {}),
  };

  const { data, isLoading, isError, error, refetch, isFetching } =
    useNotificationHistory(apiFilters);

  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const allNotifications = data?.notifications || [];
  const nextCursor = data?.pagination?.nextCursor;

  // Local filtering for read/unread state and search query
  const filteredNotifications = allNotifications.filter((n) => {
    // Read/Unread Filter
    if (readFilter === 'UNREAD' && n.read) return false;
    if (readFilter === 'READ' && !n.read) return false;

    // Search Query (title, message, referenceId, recipient)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchMessage = n.message?.toLowerCase().includes(q);
      const matchRef = n.referenceId?.toLowerCase().includes(q);
      const matchRecipient = n.recipient?.toLowerCase().includes(q);
      if (!matchTitle && !matchMessage && !matchRef && !matchRecipient) {
        return false;
      }
    }

    return true;
  });

  const unreadCount = allNotifications.filter((n) => !n.read).length;

  // 3. Handlers
  const handleFilterChange = (setter) => (val) => {
    setter(val);
    setCursorHistory([null]);
    setCurrentPageIndex(0);
  };

  const handleResetFilters = () => {
    setReadFilter('ALL');
    setChannelFilter('ALL');
    setDeliveryStatusFilter('ALL');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setCursorHistory([null]);
    setCurrentPageIndex(0);
    showSuccess('Notification filters reset.');
  };

  const handleSync = async () => {
    const toastId = showLoading('Synchronizing notifications...');
    try {
      await refetch();
      dismissToast(toastId);
      showSuccess('Notifications synchronized.');
    } catch {
      dismissToast(toastId);
      showError('Failed to sync notifications.');
    }
  };

  const handleMarkAsRead = (id) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    const unreadIds = allNotifications.filter((n) => !n.read).map((n) => n.id);
    markAllAsReadMutation.mutate(unreadIds);
  };

  const handleNextPage = () => {
    if (nextCursor) {
      const nextHistory = [...cursorHistory.slice(0, currentPageIndex + 1), nextCursor];
      setCursorHistory(nextHistory);
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const [copiedRef, setCopiedRef] = useState(null);
  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    showSuccess(`Copied: ${text}`);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Bell className="w-7 h-7 text-brand-600 dark:text-brand-400" />
              Notification Center
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 text-xs font-bold">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-channel event stream, delivery statuses, and audit trail.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh notifications"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-500 dark:text-brand-400' : ''}`}
            />
            <span>Sync</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Error State */}
      {isError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                Failed to load notification history
              </p>
              <p className="text-xs text-red-600 dark:text-red-400/80">
                {error?.response?.data?.message ||
                  error?.message ||
                  'Error communicating with Notification Service'}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Search & Comprehensive Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Top: Status Tabs + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Read / Unread Filter Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterChange(setReadFilter)('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                readFilter === 'ALL'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              All ({allNotifications.length})
            </button>
            <button
              onClick={() => handleFilterChange(setReadFilter)('UNREAD')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                readFilter === 'UNREAD'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => handleFilterChange(setReadFilter)('READ')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                readFilter === 'READ'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              Read ({allNotifications.length - unreadCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, message, reference..."
              value={searchQuery}
              onChange={(e) => handleFilterChange(setSearchQuery)(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Bottom: Channel, Delivery Status, Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          {/* Channel Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Delivery Channel
            </label>
            <select
              value={channelFilter}
              onChange={(e) => handleFilterChange(setChannelFilter)(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Channels (Email, SMS)</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="PUSH">Push</option>
            </select>
          </div>

          {/* Delivery Status Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Delivery Status
            </label>
            <select
              value={deliveryStatusFilter}
              onChange={(e) => handleFilterChange(setDeliveryStatusFilter)(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Delivery Statuses</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleFilterChange(setStartDate)(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleFilterChange(setEndDate)(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {(channelFilter !== 'ALL' ||
          deliveryStatusFilter !== 'ALL' ||
          searchQuery ||
          startDate ||
          endDate) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* 4. Notification Items / Loading / Empty State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" className="h-10 w-10" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 shadow-sm text-center flex flex-col items-center justify-center max-w-md mx-auto my-8">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
            <Bell className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            No Notifications Found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {readFilter === 'UNREAD'
              ? 'You have caught up on all unread notifications.'
              : 'No alerts or audit logs match your search and filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const channelMeta = CHANNEL_CONFIG[notification.channel] || CHANNEL_CONFIG.EMAIL;
              const ChannelIcon = channelMeta.icon;
              const statusMeta = STATUS_CONFIG[notification.status] || STATUS_CONFIG.SENT;
              const hasFailed =
                notification.status === 'FAILED' || Boolean(notification.errorMessage);
              const refId = notification.referenceId || notification.payload?.referenceId;

              return (
                <div
                  key={notification.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col gap-3 ${
                    notification.read
                      ? 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 shadow-sm opacity-85'
                      : 'bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-900/60 border-brand-500/40 shadow-md ring-1 ring-brand-500/10'
                  }`}
                >
                  {/* Top Bar: Channel Badge, Status Chip, Title, Timestamp, Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Channel Icon Avatar */}
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border ${channelMeta.badgeClass}`}
                      >
                        <ChannelIcon className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-brand-500 dark:bg-brand-400 animate-pulse" />
                          )}

                          {/* Channel Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${channelMeta.badgeClass}`}
                          >
                            <ChannelIcon className="w-3 h-3" />
                            {channelMeta.label}
                          </span>

                          {/* Delivery Status Chip */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusMeta.chipClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                            {statusMeta.label}
                          </span>

                          {/* Retry Count Badge (if retried) */}
                          {notification.retryCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <RotateCw className="w-2.5 h-2.5" />
                              Retries: {notification.retryCount}
                            </span>
                          )}
                        </div>

                        {/* Recipient & Reference Meta */}
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono flex-wrap">
                          <span>To: {notification.recipient}</span>
                          {refId && (
                            <>
                              <span>&bull;</span>
                              <div className="flex items-center gap-1">
                                <span>Ref: {refId}</span>
                                <button
                                  onClick={() => handleCopy(refId)}
                                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                  title="Copy Reference"
                                >
                                  {copiedRef === refId ? (
                                    <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Timestamp & Mark Read */}
                    <div className="flex items-center sm:self-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/40">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {new Date(notification.timestamp).toLocaleString()}
                      </span>

                      {!notification.read ? (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={markAsReadMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Mark Read</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                          Read
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Message */}
                  <p className="text-xs text-slate-700 dark:text-slate-300 pl-0 sm:pl-13 leading-relaxed">
                    {notification.message}
                  </p>

                  {/* Error Message Section for Failed Notifications */}
                  {hasFailed && (
                    <div className="mt-1 sm:ml-13 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-rose-800 dark:text-rose-200 block mb-0.5">
                          Delivery Exception / Failure Details:
                        </span>
                        <span className="text-rose-600 dark:text-rose-300/90 font-mono text-[11px]">
                          {notification.errorMessage ||
                            'Network dispatch timeout or mail exchanger rejection.'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 5. Cursor Pagination Footer */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Page{' '}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {currentPageIndex + 1}
              </strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0 || isFetching}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 disabled:opacity-40 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={handleNextPage}
                disabled={!nextCursor || isFetching}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 disabled:opacity-40 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
