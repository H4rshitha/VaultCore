import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Wallet,
  DollarSign,
  FileText,
  Loader2,
  Sparkles,
  ArrowLeftRight,
} from 'lucide-react';
import { useAccounts, useAccountBalance } from '../hooks/useAccounts.js';
import { useTransferMoney } from '../hooks/usePayments.js';
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';
import toast from 'react-hot-toast';

export const TransferForm = ({ onTransferSuccess }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSource = searchParams.get('source');

  const { data: accountsData, isLoading: isLoadingAccounts } = useAccounts({ limit: 50 });
  const accounts = accountsData?.accounts || [];

  const [selectedSourceAccount, setSelectedSourceAccount] = useState('');
  const [transferReceipt, setTransferReceipt] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      sourceAccountNumber: '',
      targetAccountNumber: '',
      amount: '',
      description: '',
    },
  });

  // Watch fields for dynamic validations
  const watchedSource = watch('sourceAccountNumber');
  const watchedAmount = watch('amount');

  // Real-time balance hook for the currently selected source account
  const {
    data: sourceBalanceData,
    isFetching: isRefreshingBalance,
    refetch: refetchBalance,
  } = useAccountBalance(selectedSourceAccount);

  const transferMutation = useTransferMoney();

  // Set initial selected source account when accounts load or when URL search param is present
  useEffect(() => {
    if (accounts.length > 0) {
      if (preselectedSource && accounts.some((a) => a.accountNumber === preselectedSource)) {
        setSelectedSourceAccount(preselectedSource);
        setValue('sourceAccountNumber', preselectedSource);
      } else if (!selectedSourceAccount) {
        setSelectedSourceAccount(accounts[0].accountNumber);
        setValue('sourceAccountNumber', accounts[0].accountNumber);
      }
    }
  }, [accounts, preselectedSource, setValue]);

  // Sync selectedSourceAccount state when dropdown changes
  const handleSourceChange = (e) => {
    const accNum = e.target.value;
    setSelectedSourceAccount(accNum);
    setValue('sourceAccountNumber', accNum);
    setErrorMessage('');
  };

  const activeAccountObj = accounts.find((a) => a.accountNumber === selectedSourceAccount);
  const currentAvailableBalance =
    sourceBalanceData?.balance !== undefined
      ? sourceBalanceData.balance
      : activeAccountObj?.balance !== undefined
      ? activeAccountObj.balance
      : 0;
  const currentCurrency = activeAccountObj?.currency || 'USD';

  const handleManualBalanceRefresh = async () => {
    if (!selectedSourceAccount) return;
    const toastId = toast.loading('Refreshing source balance...');
    try {
      await refetchBalance();
      toast.success('Source balance refreshed.', { id: toastId });
    } catch {
      toast.error('Failed to refresh source balance.', { id: toastId });
    }
  };

  const onSubmit = (formData) => {
    setErrorMessage('');
    const amountNum = parseFloat(formData.amount);

    if (amountNum > currentAvailableBalance) {
      const msg = 'Transfer amount exceeds available balance.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (formData.sourceAccountNumber === formData.targetAccountNumber) {
      const msg = 'Source and destination accounts cannot be identical.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    transferMutation.mutate(
      {
        sourceAccountNumber: formData.sourceAccountNumber,
        targetAccountNumber: formData.targetAccountNumber,
        amount: amountNum,
        currency: currentCurrency,
        description: formData.description,
      },
      {
        onSuccess: (res) => {
          setErrorMessage('');
          setTransferReceipt({
            ...res,
            sourceAccountNumber: formData.sourceAccountNumber,
            targetAccountNumber: formData.targetAccountNumber,
            amount: amountNum,
            currency: currentCurrency,
            description: formData.description,
            timestamp: new Date().toISOString(),
          });
          reset({
            sourceAccountNumber: selectedSourceAccount,
            targetAccountNumber: '',
            amount: '',
            description: '',
          });
          if (onTransferSuccess) onTransferSuccess(res);
        },
        onError: (err) => {
          const errData = err.response?.data;
          const msg =
            errData?.error?.message ||
            errData?.message ||
            (typeof errData?.error === 'string' ? errData.error : null) ||
            err.message ||
            'Transfer failed. Destination account does not exist or invalid amount.';
          setErrorMessage(msg);
        },
      }
    );
  };

  // Success Receipt View
  if (transferReceipt) {
    return (
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950 border border-emerald-500/30 shadow-xl dark:shadow-2xl backdrop-blur-xl max-w-xl mx-auto">
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold tracking-wider uppercase border border-emerald-500/20 mb-2">
            Payment Completed
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(transferReceipt.amount, transferReceipt.currency)}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Settled via Double-Entry Ledger & Distributed Lock
          </p>
        </div>

        {/* Transfer Breakdown */}
        <div className="py-6 space-y-3 text-xs">
          {transferReceipt.referenceId && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">Reference ID</span>
              <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">{transferReceipt.referenceId}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-slate-500 dark:text-slate-400">Source Account</span>
            <span className="font-mono text-slate-900 dark:text-slate-200 font-medium">
              {maskAccountNumber(transferReceipt.sourceAccountNumber)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-slate-500 dark:text-slate-400">Destination Account</span>
            <span className="font-mono text-slate-900 dark:text-slate-200 font-medium">
              {maskAccountNumber(transferReceipt.targetAccountNumber)}
            </span>
          </div>
          {transferReceipt.description && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">Description</span>
              <span className="text-slate-800 dark:text-slate-200">{transferReceipt.description}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-500 dark:text-slate-400">Timestamp</span>
            <span className="text-slate-800 dark:text-slate-200">
              {new Date(transferReceipt.timestamp).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setTransferReceipt(null)}
            className="w-full sm:w-1/2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all"
          >
            Make Another Transfer
          </button>
          <button
            onClick={() => navigate('/transactions')}
            className="w-full sm:w-1/2 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-1.5"
          >
            <span>View All Transactions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500 dark:text-brand-400 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Transfer Funds</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Instant ACID-compliant internal and external payments</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
          <span>Zero-Overdraft Protected</span>
        </div>
      </div>

      {/* Error Callout Banner */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-800 dark:text-red-200">{errorMessage}</p>
            <p className="text-[11px] text-red-600 dark:text-red-400/80">
              Please ensure the destination account number is a valid 12-digit account registered in the system. You can open additional accounts in the <strong>Accounts</strong> tab.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* 1. Source Account Dropdown */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Source Account
            </label>
            <button
              type="button"
              onClick={handleManualBalanceRefresh}
              disabled={isRefreshingBalance || !selectedSourceAccount}
              className="text-[11px] text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin text-brand-500 dark:text-brand-400' : ''}`} />
              <span>Refresh Balance</span>
            </button>
          </div>

          {isLoadingAccounts ? (
            <div className="h-11 w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse"></div>
          ) : accounts.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs">
              No deposit accounts found. Please open an account first before transferring funds.
            </div>
          ) : (
            <select
              value={selectedSourceAccount}
              onChange={handleSourceChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {accounts.map((acc) => (
                <option key={acc.accountNumber} value={acc.accountNumber}>
                  {acc.type || 'CHECKING'} • {maskAccountNumber(acc.accountNumber)} ({formatCurrency(acc.balance, acc.currency)})
                </option>
              ))}
            </select>
          )}

          {/* Available balance highlight chip */}
          {selectedSourceAccount && (
            <div className="mt-2.5 flex items-center justify-between p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Available Balance
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(currentAvailableBalance, currentCurrency)}
              </span>
            </div>
          )}
        </div>

        {/* 2. Destination Account Number */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Destination Account Number (12 Digits)
          </label>
          <input
            type="text"
            maxLength={12}
            placeholder="e.g. 100010001002"
            {...register('targetAccountNumber', {
              required: 'Destination account number is required',
              pattern: {
                value: /^\d{12}$/,
                message: 'Destination account must be a 12-digit numeric number',
              },
              validate: (val) =>
                val !== selectedSourceAccount || 'Source and destination accounts cannot be the same',
            })}
            className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border ${
              errors.targetAccountNumber ? 'border-red-500' : 'border-slate-300 dark:border-slate-800'
            } rounded-xl text-sm text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
          />
          {errors.targetAccountNumber && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.targetAccountNumber.message}</p>
          )}
        </div>

        {/* 3. Transfer Amount */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Transfer Amount ({currentCurrency})
            </label>
            {watchedAmount && parseFloat(watchedAmount) > currentAvailableBalance && (
              <span className="text-xs font-semibold text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Exceeds balance
              </span>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <DollarSign className="w-4 h-4" />
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...register('amount', {
                required: 'Amount is required',
                validate: {
                  positive: (val) => parseFloat(val) > 0 || 'Amount must be greater than 0',
                  maxBalance: (val) =>
                    parseFloat(val) <= currentAvailableBalance ||
                    `Amount cannot exceed available balance (${formatCurrency(
                      currentAvailableBalance,
                      currentCurrency
                    )})`,
                },
              })}
              className={`w-full pl-9 pr-24 py-2.5 bg-slate-50 dark:bg-slate-950 border ${
                errors.amount ? 'border-red-500' : 'border-slate-300 dark:border-slate-800'
              } rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
            />
            {/* Quick MAX button */}
            <button
              type="button"
              onClick={() => setValue('amount', String(currentAvailableBalance), { shouldValidate: true })}
              className="absolute inset-y-1.5 right-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-brand-600 dark:text-brand-400 rounded-lg transition-colors"
            >
              MAX
            </button>
          </div>
          {errors.amount && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.amount.message}</p>
          )}
        </div>

        {/* 4. Optional Description / Reference */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Reference / Memo <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <FileText className="w-4 h-4" />
            </div>
            <input
              type="text"
              maxLength={255}
              placeholder="e.g. Monthly rent, invoice payment, lunch"
              {...register('description', {
                maxLength: { value: 255, message: 'Description cannot exceed 255 characters' },
              })}
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {errors.description && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.description.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={transferMutation.isPending || accounts.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Transfer...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Send {watchedAmount ? formatCurrency(parseFloat(watchedAmount) || 0, currentCurrency) : 'Payment'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
