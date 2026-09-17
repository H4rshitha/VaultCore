import React from 'react';
import { Wallet, Landmark, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { formatCurrency, calculateTotalBalance } from '../utils/currency.js';
import { ACCOUNT_STATUS } from '../utils/accountConstants.js';
import { useNavigate } from 'react-router-dom';

export const BalanceSummaryCard = ({ accounts = [], isLoading = false }) => {
  const navigate = useNavigate();
  const totalBalance = calculateTotalBalance(accounts);
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((acc) => acc.status === ACCOUNT_STATUS.ACTIVE).length;


  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse flex flex-col justify-between h-36"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-800 rounded"></div>
              <div className="h-10 w-10 bg-slate-800 rounded-xl"></div>
            </div>
            <div className="h-8 w-36 bg-slate-800 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
      {/* 1. Total Net Balance Card */}
      <div className="relative overflow-hidden p-6 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950 border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-xl backdrop-blur-xl transition-colors">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Net Balance
          </span>
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <Landmark className="w-5 h-5" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(totalBalance, accounts[0]?.currency || 'USD')}
          </h2>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
              Real-time Ledger
            </span>
            <span>&bull;</span>
            <span>{totalAccounts} Accounts Aggregate</span>
          </div>
        </div>
      </div>

      {/* 2. Total Accounts Card */}
      <div className="relative overflow-hidden p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-xl backdrop-blur-xl flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Portfolios
          </span>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {totalAccounts}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Checking & Savings Accounts</p>
          </div>
          <button
            onClick={() => navigate('/accounts')}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition-colors"
          >
            Manage <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Active Accounts Status Card */}
      <div className="relative overflow-hidden p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-xl backdrop-blur-xl flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Accounts
          </span>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {activeAccounts} <span className="text-sm font-normal text-slate-400 dark:text-slate-500">/ {totalAccounts}</span>
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400/90 mt-1 font-medium flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
              All Services Operational
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
