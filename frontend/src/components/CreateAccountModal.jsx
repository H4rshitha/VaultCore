import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Plus, AlertCircle, Loader2, DollarSign, UserCheck } from 'lucide-react';
import { useCreateAccount } from '../hooks/useAccounts.js';
import { useAuth } from '../hooks/useAuth.js';
import { CustomerSearch } from './CustomerSearch.jsx';
import { ACCOUNT_TYPES, ACCOUNT_CURRENCIES } from '../utils/accountConstants.js';

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'CHECKING', label: 'Checking / Current (Daily Operations)' },
  { value: 'SAVINGS', label: 'High-Yield Savings (Interest Bearing)' },
  { value: 'INVESTMENT', label: 'Investment & Treasury Portfolio' },
];

const CURRENCY_LABELS = {
  USD: 'US Dollar ($)',
  EUR: 'Euro (€)',
  GBP: 'British Pound (£)',
  INR: 'Indian Rupee (₹)',
  CAD: 'Canadian Dollar (C$)',
  AUD: 'Australian Dollar (A$)',
  SGD: 'Singapore Dollar (S$)',
  JPY: 'Japanese Yen (¥)',
};

export const CreateAccountModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const createAccountMutation = useCreateAccount();
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const isTellerOrAdmin = currentUser?.role === 'TELLER' || currentUser?.role === 'ADMIN';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: 'CHECKING',
      currency: 'USD',
      initialDeposit: 100,
    },
  });

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    setSelectedCustomer(null);
    setErrorMessage('');
    onClose();
  };

  const onSubmit = (formData) => {
    setErrorMessage('');

    if (isTellerOrAdmin && !selectedCustomer) {
      setErrorMessage('Please search and select a customer before opening an account.');
      return;
    }

    const payload = {
      type: formData.type,
      currency: formData.currency,
      initialDeposit: parseFloat(formData.initialDeposit) || 0,
      ...(isTellerOrAdmin && selectedCustomer
        ? {
            customerId: selectedCustomer.customerId || selectedCustomer.id,
            _customerName:
              selectedCustomer.fullName ||
              `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim(),
          }
        : {}),
    };

    createAccountMutation.mutate(payload, {
      onSuccess: () => {
        handleClose();
      },
      onError: (err) => {
        const errData = err.response?.data;
        setErrorMessage(
          errData?.error?.message ||
            errData?.message ||
            (typeof errData?.error === 'string' ? errData.error : null) ||
            err.message ||
            'Failed to open account. Please try again.'
        );
      },
    });
  };

  const isSubmitDisabled =
    createAccountMutation.isPending || (isTellerOrAdmin && !selectedCustomer);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 z-10 overflow-hidden transition-colors max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              {isTellerOrAdmin ? <UserCheck className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isTellerOrAdmin ? 'Teller: Open Customer Account' : 'Open New Account'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isTellerOrAdmin
                  ? 'Provision a verified bank account for an onboarded customer'
                  : 'Add a new currency account to your portfolio'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {/* Teller Customer Search Section */}
          {isTellerOrAdmin && (
            <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
              <CustomerSearch
                selectedCustomer={selectedCustomer}
                onSelectCustomer={(cust) => {
                  setSelectedCustomer(cust);
                  setErrorMessage('');
                }}
                onClearSelection={() => setSelectedCustomer(null)}
              />
            </div>
          )}

          {/* Account Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Account Type
            </label>
            <select
              {...register('type', { required: 'Please select an account type' })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {ACCOUNT_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Settlement Currency
            </label>
            <select
              {...register('currency', { required: 'Please select a currency' })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {ACCOUNT_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code} — {CURRENCY_LABELS[code] || code}
                </option>
              ))}
            </select>
          </div>

          {/* Initial Deposit */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Initial Deposit Balance
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('initialDeposit', {
                  required: 'Initial deposit amount is required',
                  min: { value: 0, message: 'Initial deposit cannot be negative' },
                })}
                placeholder="0.00"
                className={`w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border ${
                  errors.initialDeposit
                    ? 'border-red-500'
                    : 'border-slate-300 dark:border-slate-800'
                } rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
              />
            </div>
            {errors.initialDeposit && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {errors.initialDeposit.message}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800/80">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createAccountMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isTellerOrAdmin ? 'Open Account for Customer' : 'Create Account'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
