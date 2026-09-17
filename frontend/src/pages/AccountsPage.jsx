import React, { useState } from 'react';
import { useAccounts, useAccount } from '../hooks/useAccounts.js';
import { AccountCard } from '../components/AccountCard.jsx';
import { CreateAccountModal } from '../components/CreateAccountModal.jsx';
import { Button } from '../components/ui/Button.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { showSuccess, showError, showLoading, dismissToast } from '../utils/toast.js';
import { ACCOUNT_STATUS, ACCOUNT_TYPES } from '../utils/accountConstants.js';
import {
  Plus,
  RefreshCw,
  Wallet,
  AlertCircle,
  Shield,
  Building2,
  TrendingUp,
  CreditCard,
  X,
  ArrowLeftRight,
} from 'lucide-react';
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';
import { useNavigate } from 'react-router-dom';

export const AccountsPage = () => {
  const navigate = useNavigate();
  // Manual refresh only for AccountsPage (no refetchInterval)
  const { data, isLoading, isError, error, refetch, isFetching } = useAccounts({ limit: 50 });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAccountNumber, setSelectedAccountNumber] = useState(null);

  // Hook for single account detailed view
  const { data: selectedAccountDetails, isFetching: isLoadingDetails } =
    useAccount(selectedAccountNumber);

  const accounts = data?.accounts || [];

  const handleSync = async () => {
    const toastId = showLoading('Synchronizing accounts...');
    try {
      const res = await refetch();
      dismissToast(toastId);
      if (res.isError) {
        showError('Failed to sync accounts.');
      } else {
        showSuccess('Accounts synchronized successfully.');
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
      }
    } catch {
      dismissToast(toastId);
      showError('Retry failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Accounts Portfolio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your deposit accounts, verify balances, and create new currency vaults.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh accounts"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-500 dark:text-brand-400' : ''}`}
            />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Account</span>
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
                Failed to load accounts
              </p>
              <p className="text-xs text-red-600 dark:text-red-400/80">
                {error?.response?.data?.message ||
                  error?.message ||
                  'Error communicating with Account Service'}
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

      {/* 3. Account Grid / Skeletons / Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 shadow-sm text-center flex flex-col items-center justify-center max-w-lg mx-auto my-12">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
            No Active Bank Accounts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            Get started by opening your first VaultCore Checking, Savings, or Commercial account.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Open New Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((account) => (
            <AccountCard
              key={account.accountNumber || account.id}
              account={account}
              onSelect={(acc) => setSelectedAccountNumber(acc.accountNumber)}
            />
          ))}
        </div>
      )}

      {/* 4. Account Details Modal */}
      {selectedAccountNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSelectedAccountNumber(null)}
            className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Account Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {maskAccountNumber(selectedAccountNumber)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccountNumber(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="space-y-4 py-6">
                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
              </div>
            ) : selectedAccountDetails ? (
              <div className="space-y-4">
                {/* Balance display */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Current Balance
                  </span>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {formatCurrency(
                      selectedAccountDetails.balance,
                      selectedAccountDetails.currency
                    )}
                  </p>
                </div>

                {/* Account metadata breakdown */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 px-4">
                  <div className="py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Full Account Number</span>
                    <span className="font-mono text-slate-900 dark:text-white font-semibold">
                      {selectedAccountDetails.accountNumber}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Account Type</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {selectedAccountDetails.type || ACCOUNT_TYPES.CURRENT}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Currency</span>
                    <span className="text-brand-600 dark:text-brand-400 font-bold">
                      {selectedAccountDetails.currency || 'USD'}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                      {selectedAccountDetails.status || ACCOUNT_STATUS.ACTIVE}
                    </span>
                  </div>
                </div>

                {/* Quick actions inside modal */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => {
                      const accNum = selectedAccountDetails.accountNumber;
                      setSelectedAccountNumber(null);
                      navigate(`/transfer?source=${accNum}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Send Money</span>
                  </button>
                  <button
                    onClick={() => setSelectedAccountNumber(null)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 5. Create Account Modal */}
      <CreateAccountModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
};
