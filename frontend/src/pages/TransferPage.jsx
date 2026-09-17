import React from 'react';
import { TransferForm } from '../components/TransferForm.jsx';
import { useAccounts } from '../hooks/useAccounts.js';
import {
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Wallet,
  Clock,
  Landmark,
} from 'lucide-react';
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';
import { useNavigate } from 'react-router-dom';

export const TransferPage = () => {
  const navigate = useNavigate();
  const { data: accountsData } = useAccounts({ limit: 5 });
  const accounts = accountsData?.accounts || [];

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Money Transfer
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Execute instant, ACID-compliant money transfers orchestrated across distributed Redis locks and double-entry ledger.
        </p>
      </div>

      {/* 2. Main Transfer Layout (2 columns on large screens) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Transfer Form */}
        <div className="lg:col-span-2">
          <TransferForm />
        </div>

        {/* Right 1 Col: Quick Accounts & Security Assurance */}
        <div className="space-y-6">
          {/* Quick Account Balances Widget */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                Active Accounts
              </span>
              <button
                onClick={() => navigate('/accounts')}
                className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors cursor-pointer"
              >
                View All
              </button>
            </div>

            {accounts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No active accounts.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {accounts.slice(0, 3).map((acc) => (
                  <div
                    key={acc.accountNumber}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="text-slate-900 dark:text-white font-medium block">
                        {acc.type || 'CHECKING'}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                        {maskAccountNumber(acc.accountNumber)}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(acc.balance, acc.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Guarantee Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Enterprise Transaction Security
            </h3>
            <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-800 dark:text-slate-200 font-medium">Distributed Redlock:</strong> Prevents concurrent double-spending via Redis DB0 locking.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Landmark className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-800 dark:text-slate-200 font-medium">Double-Entry Ledger:</strong> Immutable debit and credit journal entries guarantees balance conservation.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-800 dark:text-slate-200 font-medium">Idempotent Execution:</strong> UUID-backed transfer requests prevent duplicate billing on network retries.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
