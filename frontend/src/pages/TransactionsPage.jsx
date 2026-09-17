import React, { useState } from 'react';
import { ReceiptText, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTransactions } from '../hooks/usePayments.js';
import { TransactionCard } from '../components/TransactionCard.jsx';
import { TransactionFilters } from '../components/TransactionFilters.jsx';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError, showLoading, dismissToast } from '../utils/toast.js';
import { Skeleton } from '../components/ui/Skeleton.jsx';

export const TransactionsPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    limit: 20,
    status: 'ALL',
    type: 'ALL',
    referenceId: '',
  });

  // Cursor Pagination Stack
  const [cursorHistory, setCursorHistory] = useState([null]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const currentCursor = cursorHistory[currentPageIndex];

  // API query filters
  const apiFilters = {
    ...filters,
    ...(currentCursor ? { cursor: currentCursor } : {}),
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useTransactions(apiFilters);

  const transactions = data?.payments || data?.transactions || [];
  const nextCursor = data?.nextCursor || data?.pagination?.nextCursor;

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCursorHistory([null]);
    setCurrentPageIndex(0);
  };

  const handleResetFilters = () => {
    setFilters({
      limit: 20,
      status: 'ALL',
      type: 'ALL',
      referenceId: '',
    });
    setCursorHistory([null]);
    setCurrentPageIndex(0);
    showSuccess('Transaction filters reset.');
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

  const handleSync = async () => {
    const toastId = showLoading('Synchronizing transactions...');
    try {
      const res = await refetch();
      dismissToast(toastId);
      if (res.isError) {
        showError('Failed to sync transactions.');
      } else {
        showSuccess('Transactions synchronized successfully.');
      }
    } catch {
      dismissToast(toastId);
      showError('Failed to sync transactions.');
    }
  };

  const handleRetry = async () => {
    const toastId = showLoading('Retrying transaction lookup...');
    try {
      const res = await refetch();
      dismissToast(toastId);
      if (res.isError) {
        showError('Retry failed. Please check network/server.');
      } else {
        showSuccess('Transactions retrieved.');
      }
    } catch {
      dismissToast(toastId);
      showError('Retry failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Transactions History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time audit log of all debit, credit, and cross-account transfers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Transactions"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-500 dark:text-brand-400' : ''}`}
            />
            <span>Sync</span>
          </button>
          <button
            onClick={() => navigate('/transfer')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Transfer</span>
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
                Failed to load transactions
              </p>
              <p className="text-xs text-red-600 dark:text-red-400/80">
                {error?.response?.data?.message ||
                  error?.message ||
                  'Error communicating with Payment Service'}
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

      {/* 3. Filter Bar */}
      <TransactionFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* 4. Transactions List / Skeletons / Empty State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 animate-pulse h-20 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded ml-auto"></div>
                <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-full ml-auto"></div>
              </div>
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 shadow-sm text-center flex flex-col items-center justify-center max-w-lg mx-auto my-8">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
            <ReceiptText className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
            No Transactions Found
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            {filters.status !== 'ALL' || filters.type !== 'ALL' || filters.referenceId
              ? 'No transactions match your selected filter criteria. Try clearing your filters.'
              : 'You have not executed any payments or transfers yet. Transfer money to generate your first transaction record.'}
          </p>
          {filters.status !== 'ALL' || filters.type !== 'ALL' || filters.referenceId ? (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={() => navigate('/transfer')}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Make First Transfer</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 mb-1">
              <span>Showing {transactions.length} record(s)</span>
              <span className="text-[11px] font-mono">Click card for audit details</span>
            </div>

            {transactions.map((tx) => (
              <TransactionCard
                key={tx.referenceId || tx.id || tx._id || Math.random()}
                transaction={tx}
              />
            ))}
          </div>

          {/* 5. Cursor Pagination Footer (Matching Ledger Audit page style) */}
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
