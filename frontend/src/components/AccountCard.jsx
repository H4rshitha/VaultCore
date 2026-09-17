import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Wallet,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  Shield,
  CreditCard,
  Building2,
  TrendingUp,
  LineChart,
} from 'lucide-react';
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';
import { ACCOUNT_STATUS, ACCOUNT_TYPES } from '../utils/accountConstants.js';
import { useAccountBalance } from '../hooks/useAccounts.js';
import { useNavigate } from 'react-router-dom';

const getAccountIcon = (type = '') => {
  const upperType = type.toUpperCase();
  switch (upperType) {
    case ACCOUNT_TYPES.SAVINGS:
      return TrendingUp;
    case ACCOUNT_TYPES.BUSINESS:
      return Building2;
    case ACCOUNT_TYPES.INVESTMENT:
      return LineChart;
    case ACCOUNT_TYPES.CURRENT:
    case 'CHECKING':
    default:
      return CreditCard;
  }
};

export const AccountCard = ({ account, onSelect }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const { data: balanceData, isFetching: isRefreshingBalance, refetch: refetchBalance } =
    useAccountBalance(account.accountNumber);

  const currentBalance = balanceData?.balance !== undefined ? balanceData.balance : account.balance;
  const currentStatus = balanceData?.status || account.status || ACCOUNT_STATUS.ACTIVE;
  const Icon = getAccountIcon(account.type);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(account.accountNumber);
    setCopied(true);
    toast.success('Account number copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async (e) => {
    e.stopPropagation();
    const toastId = toast.loading(`Refreshing balance for ${maskAccountNumber(account.accountNumber)}...`);
    try {
      const res = await refetchBalance();
      if (res.isError) {
        toast.error('Failed to refresh balance.', { id: toastId });
      } else {
        toast.success('Balance refreshed successfully.', { id: toastId });
      }
    } catch {
      toast.error('Failed to refresh balance.', { id: toastId });
    }
  };


  const handleTransfer = (e) => {
    e.stopPropagation();
    navigate(`/transfer?source=${account.accountNumber}`);
  };

  return (
    <div
      onClick={() => onSelect && onSelect(account)}
      className="group relative p-5 sm:p-6 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 backdrop-blur-xl shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-2xl hover:shadow-brand-500/5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      {/* Top Row: Type, Status & Currency Badge */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-105 transition-transform">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {account.type || 'CHECKING'}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">VaultCore Deposit</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {account.currency || 'USD'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[11px] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
              {currentStatus}
            </span>
          </div>
        </div>

        {/* Account Number with Mask & Copy */}
        <div className="flex items-center justify-between p-2.5 mb-5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/70">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 tracking-wider">
              {maskAccountNumber(account.accountNumber)}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Copy Account Number"
            aria-label="Copy Account Number"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Balance Display */}
        <div className="mb-4">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Available Balance
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <h4 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(currentBalance, account.currency)}
            </h4>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
        <button
          onClick={handleRefresh}
          disabled={isRefreshingBalance}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition-colors disabled:opacity-50"
          title="Refresh real-time balance"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin text-brand-500 dark:text-brand-400' : ''}`} />
          <span>{isRefreshingBalance ? 'Syncing...' : 'Refresh Balance'}</span>
        </button>

        <button
          onClick={handleTransfer}
          className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors group-hover:translate-x-0.5"
        >
          <span>Transfer</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
