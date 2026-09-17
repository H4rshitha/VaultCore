import React, { useState } from 'react';
import {
  Search,
  Filter,
  X,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REVERSED', label: 'Reversed' },
];

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'WITHDRAWAL', label: 'Withdrawal' },
];

export const TransactionFilters = ({ filters, onFilterChange, onReset }) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v && v !== 'ALL' && k !== 'limit' && k !== 'cursor'
  ).length;

  const handleSearchChange = (e) => {
    onFilterChange({ ...filters, referenceId: e.target.value });
  };

  const handleStatusChange = (status) => {
    onFilterChange({ ...filters, status });
  };

  const handleTypeChange = (type) => {
    onFilterChange({ ...filters, type });
  };

  const handleStartDateChange = (e) => {
    onFilterChange({ ...filters, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined });
  };

  const handleEndDateChange = (e) => {
    onFilterChange({ ...filters, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined });
  };

  return (
    <div className="space-y-3">
      {/* Search Bar + Filter Trigger */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.referenceId || ''}
            onChange={handleSearchChange}
            placeholder="Search by Transaction ID or Account Number..."
            className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          />
          {filters.referenceId && (
            <button
              onClick={() => onFilterChange({ ...filters, referenceId: '' })}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Toggle Filters Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              isOpen || activeFilterCount > 0
                ? 'bg-brand-50 dark:bg-brand-600/10 border-brand-200 dark:border-brand-500/40 text-brand-600 dark:text-brand-400'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="h-5 w-5 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filter Panel */}
      {isOpen && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 transition-colors">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Transaction Status
              </label>
              <select
                value={filters.status || 'ALL'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Transaction Type
              </label>
              <select
                value={filters.type || 'ALL'}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Start & End */}
            <div className="sm:col-span-2 md:col-span-1 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  onChange={handleStartDateChange}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  onChange={handleEndDateChange}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2 flex-wrap">
              {filters.status && filters.status !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20 text-[11px]">
                  Status: {filters.status}
                  <button onClick={() => handleStatusChange('ALL')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.type && filters.type !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20 text-[11px]">
                  Type: {filters.type}
                  <button onClick={() => handleTypeChange('ALL')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={onReset}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
