import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Copy,
  Check,
  Clock,
  Shield,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';
import toast from 'react-hot-toast';

export const TransactionCard = ({ transaction }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const referenceId = transaction.referenceId || transaction.id || transaction._id || 'TX-UNKNOWN';
  const status = (transaction.status || 'COMPLETED').toUpperCase();
  const type = (transaction.type || 'TRANSFER').toUpperCase();
  const amount = typeof transaction.amount === 'number' ? transaction.amount : parseFloat(transaction.amount) || 0;
  const currency = transaction.currency || 'USD';
  const createdAt = transaction.createdAt || transaction.timestamp || transaction.date || new Date().toISOString();
  const sourceAccount = transaction.sourceAccountNumber || transaction.sourceAccount || transaction.fromAccount;
  const targetAccount = transaction.targetAccountNumber || transaction.targetAccount || transaction.toAccount;
  const description = transaction.description || transaction.note || transaction.reference;

  // Determine Debit vs Credit visual layout
  const isDebit = type === 'WITHDRAWAL' || (type === 'TRANSFER' && Boolean(sourceAccount));

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(referenceId);
    setCopied(true);
    toast.success('Transaction ID copied.');
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusChip = (s) => {
    switch (s) {
      case 'SUCCESS':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            SUCCESS
          </span>
        );
      case 'PENDING':
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            PENDING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
            FAILED
          </span>
        );
      case 'REVERSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-semibold">
            <RotateCcw className="w-3 h-3" />
            REVERSED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
            {s}
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200 cursor-pointer shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl"
    >
      {/* Top Row: Icon, Reference ID, Status Chip & Formatted Amount */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDebit
                ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isDebit ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {type}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden sm:inline">
                #{referenceId.slice(0, 8)}...
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-[200px] sm:max-w-md">
              {description || (sourceAccount && targetAccount ? `Transfer to ${maskAccountNumber(targetAccount)}` : 'Payment Transaction')}
            </p>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isDebit ? '-' : '+'}{formatCurrency(amount, currency)}
          </div>
          <div className="mt-1 flex items-center justify-end gap-2">
            {getStatusChip(status)}
          </div>
        </div>
      </div>

      {/* Expandable Transaction Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold block">
              Reference ID
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-slate-800 dark:text-slate-300 select-all">{referenceId}</span>
              <button
                onClick={handleCopy}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Copy Reference ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold block">
              Timestamp
            </span>
            <span className="text-slate-800 dark:text-slate-300 mt-1 block">
              {new Date(createdAt).toLocaleString()}
            </span>
          </div>

          {sourceAccount && (
            <div>
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold block">
                Source Account
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-300 mt-1 block">
                {maskAccountNumber(sourceAccount)}
              </span>
            </div>
          )}

          {targetAccount && (
            <div>
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold block">
                Destination Account
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-300 mt-1 block">
                {maskAccountNumber(targetAccount)}
              </span>
            </div>
          )}

          {description && (
            <div className="sm:col-span-2">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold block">
                Description / Memo
              </span>
              <span className="text-slate-800 dark:text-slate-300 mt-1 block">{description}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
