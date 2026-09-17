import React, { useState, useEffect } from 'react';
import {
  Search,
  User,
  Mail,
  Phone,
  Layers,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useCustomerSearch } from '../hooks/useAccounts.js';

export const CustomerSearch = ({ selectedCustomer, onSelectCustomer, onClearSelection }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const {
    data: searchResults = [],
    isLoading,
    isError,
    error,
  } = useCustomerSearch(debouncedQuery, {
    enabled: Boolean(debouncedQuery && !selectedCustomer),
  });

  const handleSelect = (customer) => {
    onSelectCustomer(customer);
    setSearchTerm('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Target Customer <span className="text-red-500">*</span>
        </label>
        {selectedCustomer && (
          <button
            type="button"
            onClick={onClearSelection}
            className="text-[11px] font-medium text-brand-500 hover:text-brand-400 flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Change Customer
          </button>
        )}
      </div>

      {/* Selected Customer Card */}
      {selectedCustomer ? (
        <div className="p-3.5 rounded-xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/60 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm">
                {selectedCustomer.firstName?.[0] || 'C'}
                {selectedCustomer.lastName?.[0] || ''}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedCustomer.fullName ||
                      `${selectedCustomer.firstName} ${selectedCustomer.lastName}`}
                  </h4>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    {selectedCustomer.status || 'ACTIVE'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {selectedCustomer.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {selectedCustomer.phone || '+1 (555) 019-2834'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 justify-end">
                <Layers className="w-3 h-3" />
                {selectedCustomer.existingAccountCount ??
                  selectedCustomer.accountCount ??
                  (selectedCustomer.accounts?.length || 0)}{' '}
                Accounts
              </span>
              <span
                className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate max-w-[140px]"
                title={selectedCustomer.customerId || selectedCustomer.id}
              >
                ID: {(selectedCustomer.customerId || selectedCustomer.id)?.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Search Input */
        <div className="relative">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name, email, phone, or ID..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Error State */}
          {isError && (
            <div className="mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error?.message || 'Failed to search customers.'}</span>
            </div>
          )}

          {/* Search Dropdown Results */}
          {debouncedQuery && !isLoading && !isError && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-20 max-h-56 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800/80">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  <User className="w-6 h-6 mx-auto mb-1.5 text-slate-400 dark:text-slate-600" />
                  No customer matching{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    "{debouncedQuery}"
                  </span>{' '}
                  found.
                </div>
              ) : (
                searchResults.map((cust) => {
                  const custId = cust.customerId || cust.id;
                  const count =
                    cust.existingAccountCount ?? cust.accountCount ?? (cust.accounts?.length || 0);
                  return (
                    <button
                      key={custId}
                      type="button"
                      onClick={() => handleSelect(cust)}
                      className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">
                          {cust.firstName?.[0] || 'C'}
                          {cust.lastName?.[0] || ''}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
                            {cust.fullName || `${cust.firstName} ${cust.lastName}`}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span>{cust.email}</span>
                            <span>•</span>
                            <span>{cust.phone || '+1 (555) 019-2834'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                          {count} existing {count === 1 ? 'account' : 'accounts'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
