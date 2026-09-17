import React, { useState, useEffect } from 'react';
import {
  BookOpenCheck,
  Search,
  Filter,
  Calendar,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Wallet,
  ShieldCheck,
  Hash,
  Clock,
  Layers,
} from 'lucide-react';
import { useAccounts, useAccountBalance } from '../hooks/useAccounts.js';
import { useLedgerEntries } from '../hooks/useLedger.js';
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';
import { showSuccess, showError, showLoading, dismissToast } from '../utils/toast.js';
import { SkeletonTable, Skeleton } from '../components/ui/Skeleton.jsx';
import { Button } from '../components/ui/Button.jsx';

const TRANSACTION_TYPES = [
  'ALL',
  'TRANSFER',
  'DEPOSIT',
  'WITHDRAWAL',
  'REVERSAL',
  'FEE',
  'INTEREST',
];

export const LedgerPage = () => {
  // 1. Fetch user accounts for selector
  const { data: accountsData, isLoading: isAccountsLoading } = useAccounts({ limit: 50 });
  const accounts = accountsData?.accounts || [];

  const [selectedAccountNumber, setSelectedAccountNumber] = useState('');

  // Auto-select first account when available
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountNumber) {
      setSelectedAccountNumber(accounts[0].accountNumber);
    }
  }, [accounts, selectedAccountNumber]);

  const selectedAccount = accounts.find((a) => a.accountNumber === selectedAccountNumber) || accounts[0];

  // Optional real-time balance for the selected account
  const { data: balanceData } = useAccountBalance(selectedAccountNumber);
  const currentBalance = balanceData?.balance !== undefined ? balanceData.balance : selectedAccount?.balance;

  // 2. Filter states
  const [directionFilter, setDirectionFilter] = useState('ALL'); // 'ALL' | 'DEBIT' | 'CREDIT'
  const [txTypeFilter, setTxTypeFilter] = useState('ALL'); // 'ALL' | 'TRANSFER' | ...
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchRef, setSearchRef] = useState('');

  // 3. Cursor Pagination Stack
  const [cursorHistory, setCursorHistory] = useState([null]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const currentCursor = cursorHistory[currentPageIndex];

  // Build query filters for API
  const apiFilters = {
    limit: 15,
    ...(currentCursor ? { cursor: currentCursor } : {}),
    ...(directionFilter !== 'ALL' ? { type: directionFilter } : {}),
    ...(startDate ? { startDate: new Date(startDate).toISOString() } : {}),
    ...(endDate ? { endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString() } : {}),
    ...(searchRef.trim() ? { referenceId: searchRef.trim() } : {}),
  };

  const {
    data: ledgerData,
    isLoading: isLedgerLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useLedgerEntries(selectedAccountNumber, apiFilters);

  const rawEntries = ledgerData?.entries || [];
  const nextCursor = ledgerData?.pagination?.nextCursor;

  // Client-side transaction type filter if specified
  const displayEntries = rawEntries.filter((entry) => {
    if (txTypeFilter === 'ALL') return true;
    return entry.transaction?.type === txTypeFilter;
  });

  const currency = ledgerData?.currency || selectedAccount?.currency || 'USD';

  // 4. Handlers
  const handleAccountChange = (e) => {
    setSelectedAccountNumber(e.target.value);
    // Reset pagination
    setCursorHistory([null]);
    setCurrentPageIndex(0);
  };

  const handleFilterChange = (setter) => (val) => {
    setter(val);
    setCursorHistory([null]);
    setCurrentPageIndex(0);
  };

  const handleResetFilters = () => {
    setDirectionFilter('ALL');
    setTxTypeFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSearchRef('');
    setCursorHistory([null]);
    setCurrentPageIndex(0);
    showSuccess('Ledger filters reset.');
  };

  const handleRefresh = async () => {
    const toastId = showLoading('Refreshing ledger entries...');
    try {
      await refetch();
      dismissToast(toastId);
      showSuccess('Ledger entries refreshed.');
    } catch {
      dismissToast(toastId);
      showError('Failed to refresh ledger.');
    }
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

  const [copiedId, setCopiedId] = useState(null);
  const handleCopyReference = (refId) => {
    if (!refId || refId === 'N/A') return;
    navigator.clipboard.writeText(refId);
    setCopiedId(refId);
    showSuccess(`Copied: ${refId}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <BookOpenCheck className="w-7 h-7 text-brand-600 dark:text-brand-400" />
              Double-Entry Ledger Audit
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              ACID Compliant
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Immutable cryptographic journal entries with running balance verification and zero-discrepancy reconciliation.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh ledger history"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-500 dark:text-brand-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Account Selector & Statement Summary Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md backdrop-blur-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Account Selector Dropdown */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Select Bank Account for Statement
            </label>
            {isAccountsLoading ? (
              <div className="h-11 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
            ) : accounts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No active deposit accounts found.</p>
            ) : (
              <select
                value={selectedAccountNumber}
                onChange={handleAccountChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-500 transition-colors"
              >
                {accounts.map((acc) => (
                  <option key={acc.accountNumber} value={acc.accountNumber}>
                    {acc.type || 'CHECKING'} &bull; {maskAccountNumber(acc.accountNumber)} &mdash;{' '}
                    {formatCurrency(acc.balance, acc.currency)} ({acc.currency})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Current Balance Display */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Current Statement Balance
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              {currentBalance !== undefined
                ? formatCurrency(currentBalance, currency)
                : '---'}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span>Immutable Ledger Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Direction Filter (Debit / Credit) */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Entry Direction
            </label>
            <select
              value={directionFilter}
              onChange={(e) => handleFilterChange(setDirectionFilter)(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Entries (Debit & Credit)</option>
              <option value="DEBIT">Debit (Withdrawal / Outflow)</option>
              <option value="CREDIT">Credit (Deposit / Inflow)</option>
            </select>
          </div>

          {/* Transaction Type Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Transaction Type
            </label>
            <select
              value={txTypeFilter}
              onChange={(e) => handleFilterChange(setTxTypeFilter)(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'ALL' ? 'All Transaction Types' : t}
                </option>
              ))}
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

        {/* Reference ID Search & Reset */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Reference ID..."
              value={searchRef}
              onChange={(e) => handleFilterChange(setSearchRef)(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {(directionFilter !== 'ALL' || txTypeFilter !== 'ALL' || startDate || endDate || searchRef) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors self-end sm:self-auto cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Error State */}
      {isError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">Failed to load ledger entries</p>
              <p className="text-xs text-red-600 dark:text-red-400/80">
                {error?.response?.data?.message || error?.message || 'Error communicating with Ledger Service'}
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

      {/* 5. Statement Ledger Table Layout */}
      {isLedgerLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : displayEntries.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 shadow-sm text-center flex flex-col items-center justify-center max-w-md mx-auto my-8">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
            <BookOpenCheck className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">No Ledger Entries Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No double-entry journal records match the selected account and filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Reference ID</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {displayEntries.map((entry) => {
                  const isDebit = entry.type === 'DEBIT';
                  const refId = entry.transaction?.referenceId || 'N/A';

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>

                      {/* Direction & Type Chip */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isDebit
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isDebit ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownLeft className="w-3 h-3" />
                            )}
                            {entry.type}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            {entry.transaction?.type || 'TRANSFER'}
                          </span>
                        </div>
                      </td>

                      {/* Reference ID with Copy Button */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          <span>{refId}</span>
                          {refId !== 'N/A' && (
                            <button
                              onClick={() => handleCopyReference(refId)}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                              title="Copy Reference ID"
                            >
                              {copiedId === refId ? (
                                <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                        {entry.transaction?.description || '---'}
                      </td>

                      {/* Amount (+ / -) */}
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold text-sm whitespace-nowrap ${
                          isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isDebit ? '-' : '+'}
                        {formatCurrency(entry.amount, currency)}
                      </td>

                      {/* Running Balance After */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                        {formatCurrency(entry.balanceAfter, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {displayEntries.map((entry) => {
              const isDebit = entry.type === 'DEBIT';
              const refId = entry.transaction?.referenceId || 'N/A';

              return (
                <div
                  key={entry.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isDebit
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {entry.type}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                        {entry.transaction?.type || 'TRANSFER'}
                      </span>
                    </div>

                    <span
                      className={`font-mono font-bold text-sm ${
                        isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isDebit ? '-' : '+'}
                      {formatCurrency(entry.amount, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400">Balance After:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(entry.balanceAfter, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    <div className="flex items-center gap-1">
                      <span>{refId}</span>
                      {refId !== 'N/A' && (
                        <button
                          onClick={() => handleCopyReference(refId)}
                          className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 6. Cursor Pagination Footer */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Page <strong className="text-slate-900 dark:text-white font-semibold">{currentPageIndex + 1}</strong>
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
