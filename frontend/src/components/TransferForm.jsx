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
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
} from 'lucide-react';
import { useAccounts, useAccountBalance } from '../hooks/useAccounts.js';
import { useTransferMoney, useDepositMoney, useWithdrawMoney } from '../hooks/usePayments.js';
import { useAuth } from '../hooks/useAuth.js';
import { formatCurrency, maskAccountNumber } from '../utils/currency.js';
import toast from 'react-hot-toast';

export const TransferForm = ({ onTransferSuccess }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'TELLER' || currentUser?.role === 'ADMIN';

  // Read URL search params
  const initialMode = searchParams.get('mode') || 'transfer';
  const preselectedAcc = searchParams.get('acc') || searchParams.get('source');

  const [activeTab, setActiveTab] = useState(initialMode); // 'transfer' | 'deposit' | 'withdraw'
  const [selectedAccount, setSelectedAccount] = useState(preselectedAcc || '');
  const [operationReceipt, setOperationReceipt] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: accountsData, isLoading: isLoadingAccounts } = useAccounts({ limit: 100 });
  const accounts = accountsData?.accounts || [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      sourceAccountNumber: preselectedAcc || '',
      targetAccountNumber: '',
      accountNumber: preselectedAcc || '',
      amount: '',
      description: '',
    },
  });

  const watchedSource = watch('sourceAccountNumber');
  const watchedAcc = watch('accountNumber');
  const activeAccountNum = activeTab === 'transfer' ? watchedSource || selectedAccount : watchedAcc || selectedAccount;

  // Real-time balance hook for the currently active account
  const {
    data: accountBalanceData,
    isFetching: isRefreshingBalance,
    refetch: refetchBalance,
  } = useAccountBalance(activeAccountNum);

  const transferMutation = useTransferMoney();
  const depositMutation = useDepositMoney();
  const withdrawMutation = useWithdrawMoney();

  // Sync mode with URL
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam && ['transfer', 'deposit', 'withdraw'].includes(modeParam)) {
      setActiveTab(modeParam);
    }
    const accParam = searchParams.get('acc') || searchParams.get('source');
    if (accParam) {
      setSelectedAccount(accParam);
      setValue('sourceAccountNumber', accParam);
      setValue('accountNumber', accParam);
    }
  }, [searchParams, setValue]);

  // Set initial account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      const defaultAcc = accounts[0].accountNumber;
      setSelectedAccount(defaultAcc);
      setValue('sourceAccountNumber', defaultAcc);
      setValue('accountNumber', defaultAcc);
    }
  }, [accounts, selectedAccount, setValue]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ mode: newTab, ...(selectedAccount ? { acc: selectedAccount } : {}) });
    setErrorMessage('');
    setOperationReceipt(null);
  };

  const activeAccountObj = accounts.find((a) => a.accountNumber === activeAccountNum);
  const currentAvailableBalance =
    accountBalanceData?.balance !== undefined
      ? Number(accountBalanceData.balance)
      : activeAccountObj?.balance !== undefined
        ? Number(activeAccountObj.balance)
        : 0;
  const currentCurrency = activeAccountObj?.currency || 'USD';

  const handleManualBalanceRefresh = async () => {
    if (!activeAccountNum) return;
    const toastId = toast.loading('Refreshing balance...');
    try {
      await refetchBalance();
      toast.success('Account balance refreshed.', { id: toastId });
    } catch {
      toast.error('Failed to refresh balance.', { id: toastId });
    }
  };

  const onSubmit = (formData) => {
    setErrorMessage('');
    const amountNum = parseFloat(formData.amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage('Please enter a valid positive amount.');
      return;
    }

    if (activeTab === 'transfer') {
      const sourceAcc = formData.sourceAccountNumber || selectedAccount;
      const targetAcc = formData.targetAccountNumber;

      if (!sourceAcc || !targetAcc) {
        setErrorMessage('Both source and destination accounts are required.');
        return;
      }

      if (sourceAcc === targetAcc) {
        const msg = 'Source and destination accounts cannot be identical.';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      if (amountNum > currentAvailableBalance) {
        const msg = 'Transfer amount exceeds available source account balance.';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      transferMutation.mutate(
        {
          sourceAccountNumber: sourceAcc,
          targetAccountNumber: targetAcc,
          amount: amountNum,
          currency: currentCurrency,
          description: formData.description || 'Inter-account transfer',
        },
        {
          onSuccess: (res) => {
            setErrorMessage('');
            setOperationReceipt({
              type: 'TRANSFER',
              title: 'Transfer Completed',
              referenceId: res?.referenceId || res?.transaction?.referenceId,
              sourceAccountNumber: sourceAcc,
              targetAccountNumber: targetAcc,
              amount: amountNum,
              currency: currentCurrency,
              description: formData.description || 'Inter-account transfer',
              timestamp: new Date().toISOString(),
            });
            reset({
              sourceAccountNumber: sourceAcc,
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
              err.message ||
              'Transfer failed. Check destination account and balance.';
            setErrorMessage(msg);
          },
        }
      );
    } else if (activeTab === 'deposit') {
      const targetAcc = formData.accountNumber || selectedAccount;
      if (!targetAcc) {
        setErrorMessage('Account number is required for deposit.');
        return;
      }

      depositMutation.mutate(
        {
          accountNumber: targetAcc,
          amount: amountNum,
          currency: currentCurrency,
          description: formData.description || 'Cash Deposit',
        },
        {
          onSuccess: (res) => {
            setErrorMessage('');
            setOperationReceipt({
              type: 'DEPOSIT',
              title: 'Cash Deposit Completed',
              referenceId: res?.referenceId || res?.transaction?.referenceId,
              accountNumber: targetAcc,
              amount: amountNum,
              currency: currentCurrency,
              description: formData.description || 'Cash Deposit',
              timestamp: new Date().toISOString(),
            });
            reset({
              accountNumber: targetAcc,
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
              err.message ||
              'Deposit failed. Check account status.';
            setErrorMessage(msg);
          },
        }
      );
    } else if (activeTab === 'withdraw') {
      const targetAcc = formData.accountNumber || selectedAccount;
      if (!targetAcc) {
        setErrorMessage('Account number is required for withdrawal.');
        return;
      }

      if (amountNum > currentAvailableBalance) {
        const msg = 'Withdrawal amount exceeds available balance.';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      withdrawMutation.mutate(
        {
          accountNumber: targetAcc,
          amount: amountNum,
          currency: currentCurrency,
          description: formData.description || 'Cash Withdrawal',
        },
        {
          onSuccess: (res) => {
            setErrorMessage('');
            setOperationReceipt({
              type: 'WITHDRAW',
              title: 'Cash Withdrawal Completed',
              referenceId: res?.referenceId || res?.transaction?.referenceId,
              accountNumber: targetAcc,
              amount: amountNum,
              currency: currentCurrency,
              description: formData.description || 'Cash Withdrawal',
              timestamp: new Date().toISOString(),
            });
            reset({
              accountNumber: targetAcc,
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
              err.message ||
              'Withdrawal failed. Check account balance.';
            setErrorMessage(msg);
          },
        }
      );
    }
  };

  const isPending =
    transferMutation.isPending || depositMutation.isPending || withdrawMutation.isPending;

  // Receipt View
  if (operationReceipt) {
    return (
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950 border border-emerald-500/30 shadow-xl dark:shadow-2xl backdrop-blur-xl max-w-xl mx-auto">
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold tracking-wider uppercase border border-emerald-500/20 mb-2">
            {operationReceipt.title}
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(operationReceipt.amount, operationReceipt.currency)}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Settled via Double-Entry Ledger & Distributed Lock
          </p>
        </div>

        {/* Breakdown */}
        <div className="py-6 space-y-3 text-xs">
          {operationReceipt.referenceId && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">Reference ID</span>
              <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">
                {operationReceipt.referenceId}
              </span>
            </div>
          )}

          {operationReceipt.type === 'TRANSFER' ? (
            <>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Source Account</span>
                <span className="font-mono text-slate-900 dark:text-slate-200 font-medium">
                  {maskAccountNumber(operationReceipt.sourceAccountNumber)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Destination Account</span>
                <span className="font-mono text-slate-900 dark:text-slate-200 font-medium">
                  {maskAccountNumber(operationReceipt.targetAccountNumber)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">Account Number</span>
              <span className="font-mono text-slate-900 dark:text-slate-200 font-medium">
                {maskAccountNumber(operationReceipt.accountNumber)}
              </span>
            </div>
          )}

          {operationReceipt.description && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">Memo</span>
              <span className="text-slate-800 dark:text-slate-200">{operationReceipt.description}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-500 dark:text-slate-400">Timestamp</span>
            <span className="text-slate-800 dark:text-slate-200">
              {new Date(operationReceipt.timestamp).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setOperationReceipt(null)}
            className="w-full sm:w-1/2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            New Operation
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-1/2 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Back to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl backdrop-blur-xl">
      {/* 1. Operation Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500 dark:text-brand-400 flex items-center justify-center">
            {activeTab === 'transfer' && <ArrowLeftRight className="w-5 h-5" />}
            {activeTab === 'deposit' && <ArrowDownToLine className="w-5 h-5 text-emerald-500" />}
            {activeTab === 'withdraw' && <ArrowUpFromLine className="w-5 h-5 text-amber-500" />}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {activeTab === 'transfer' && 'Transfer Funds'}
              {activeTab === 'deposit' && 'Cash Deposit'}
              {activeTab === 'withdraw' && 'Cash Withdrawal'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeTab === 'transfer' && 'Instant ACID-compliant internal and cross-account payments'}
              {activeTab === 'deposit' && 'Add verified funds into customer account with ledger credit'}
              {activeTab === 'withdraw' && 'Deduct funds from customer account with overdraft protection'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleTabChange('transfer')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'transfer'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('deposit')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'deposit'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Deposit</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('withdraw')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'withdraw'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span>Withdraw</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 flex items-start gap-3 text-xs">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-red-800 dark:text-red-200">Operation Error</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Source Account Field (Transfer) OR Account Number (Deposit/Withdraw) */}
        {activeTab === 'transfer' ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Source Account
              </label>
              <button
                type="button"
                onClick={handleManualBalanceRefresh}
                disabled={isRefreshingBalance}
                className="text-[11px] font-medium text-slate-500 hover:text-brand-500 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin text-brand-500' : ''}`} />
                <span>Refresh Balance</span>
              </button>
            </div>

            {/* Dropdown for account selection */}
            {accounts.length > 0 ? (
              <select
                {...register('sourceAccountNumber', { required: 'Source account is required' })}
                value={selectedAccount}
                onChange={(e) => {
                  setSelectedAccount(e.target.value);
                  setValue('sourceAccountNumber', e.target.value);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              >
                {accounts.map((acc) => {
                  const customerLabel = acc.user
                    ? ` (${acc.user.firstName || ''} ${acc.user.lastName || ''})`
                    : '';
                  return (
                    <option key={acc.accountNumber} value={acc.accountNumber}>
                      {acc.type} •••• {acc.accountNumber.slice(-4)} {customerLabel} (
                      {formatCurrency(acc.balance, acc.currency || 'USD')})
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                {...register('sourceAccountNumber', {
                  required: 'Source account is required',
                  pattern: { value: /^\d{12}$/, message: 'Must be a 12-digit number' },
                })}
                placeholder="Enter 12-digit source account..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            )}

            {/* Balance Badge */}
            <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                Available Balance
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                {formatCurrency(currentAvailableBalance, currentCurrency)}
              </span>
            </div>
          </div>
        ) : (
          /* Deposit / Withdraw Account Field */
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Target Account Number (12 Digits)
              </label>
              {activeTab === 'withdraw' && (
                <button
                  type="button"
                  onClick={handleManualBalanceRefresh}
                  disabled={isRefreshingBalance}
                  className="text-[11px] font-medium text-slate-500 hover:text-brand-500 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin text-brand-500' : ''}`} />
                  <span>Refresh Balance</span>
                </button>
              )}
            </div>

            {accounts.length > 0 ? (
              <select
                {...register('accountNumber', { required: 'Account number is required' })}
                value={selectedAccount}
                onChange={(e) => {
                  setSelectedAccount(e.target.value);
                  setValue('accountNumber', e.target.value);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              >
                {accounts.map((acc) => {
                  const customerLabel = acc.user
                    ? ` (${acc.user.firstName || ''} ${acc.user.lastName || ''})`
                    : '';
                  return (
                    <option key={acc.accountNumber} value={acc.accountNumber}>
                      {acc.type} •••• {acc.accountNumber.slice(-4)} {customerLabel} (
                      {formatCurrency(acc.balance, acc.currency || 'USD')})
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                {...register('accountNumber', {
                  required: 'Account number is required',
                  pattern: { value: /^\d{12}$/, message: 'Must be a 12-digit number' },
                })}
                placeholder="Enter 12-digit customer account..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            )}

            {/* Balance Badge for Withdraw / Deposit */}
            <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                Current Balance
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                {formatCurrency(currentAvailableBalance, currentCurrency)}
              </span>
            </div>
          </div>
        )}

        {/* Destination Account Field (Transfer Only) */}
        {activeTab === 'transfer' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Destination Account Number (12 Digits)
            </label>
            <input
              type="text"
              {...register('targetAccountNumber', {
                required: 'Destination account number is required',
                pattern: { value: /^\d{12}$/, message: 'Must be a 12-digit numeric account number' },
              })}
              placeholder="e.g. 100019829799"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
            />
            {errors.targetAccountNumber && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {errors.targetAccountNumber.message}
              </p>
            )}
          </div>
        )}

        {/* Amount Field */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Amount (USD)
            </label>
            {activeTab !== 'deposit' && currentAvailableBalance > 0 && (
              <button
                type="button"
                onClick={() => setValue('amount', String(currentAvailableBalance))}
                className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-500 uppercase tracking-wider cursor-pointer"
              >
                Max ({formatCurrency(currentAvailableBalance, currentCurrency)})
              </button>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-semibold text-sm">
              $
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...register('amount', {
                required: 'Amount is required',
                min: { value: 0.01, message: 'Amount must be greater than $0' },
              })}
              placeholder="1000.00"
              className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>
          {errors.amount && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.amount.message}</p>
          )}
        </div>

        {/* Description / Memo */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            Reference / Memo (Optional)
          </label>
          <input
            type="text"
            {...register('description', {
              maxLength: { value: 255, message: 'Memo cannot exceed 255 characters' },
            })}
            placeholder={
              activeTab === 'transfer'
                ? 'e.g. Monthly rent, Invoice #402'
                : activeTab === 'deposit'
                  ? 'e.g. Branch counter cash deposit'
                  : 'e.g. ATM / Counter cash withdrawal'
            }
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className={`w-full py-3 px-4 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            activeTab === 'deposit'
              ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-emerald-600/30'
              : activeTab === 'withdraw'
                ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-amber-600/30'
                : 'bg-brand-600 hover:bg-brand-500 active:bg-brand-700 shadow-brand-600/30'
          }`}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing Transaction...</span>
            </>
          ) : (
            <>
              {activeTab === 'transfer' && <span>Execute Instant Transfer</span>}
              {activeTab === 'deposit' && <span>Process Cash Deposit</span>}
              {activeTab === 'withdraw' && <span>Process Cash Withdrawal</span>}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default TransferForm;
