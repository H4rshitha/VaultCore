import React from 'react';

export const Skeleton = ({
  className = '',
  variant = 'rectangular', // 'rectangular' | 'circular' | 'text'
  width,
  height,
  ...props
}) => {
  const variantClasses = {
    rectangular: 'rounded-xl',
    circular: 'rounded-full',
    text: 'rounded-md h-4',
  };

  const currentVariant = variantClasses[variant] || variantClasses.rectangular;

  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800/80 border border-slate-300/40 dark:border-slate-700/30 ${currentVariant} ${className}`}
      style={{ width, height }}
      {...props}
    />
  );
};

export const SkeletonText = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          variant="text"
          className={`h-3.5 ${idx === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
};

export const SkeletonCard = ({ className = '', rows = 3 }) => {
  return (
    <div className={`bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-md ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton variant="circular" className="h-8 w-8" />
      </div>
      <Skeleton className="h-8 w-1/2 mb-4" />
      <SkeletonText lines={rows} />
    </div>
  );
};

export const SkeletonAccountCard = ({ className = '' }) => {
  return (
    <div className={`bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-md space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" className="h-10 w-10" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="pt-2">
        <Skeleton className="h-7 w-36 mb-1" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
};

export const SkeletonTable = ({ rows = 5, cols = 4, className = '' }) => {
  return (
    <div className={`w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D1322] ${className}`}>
      {/* Table Header Skeleton */}
      <div className="bg-slate-100 dark:bg-slate-900/60 px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-slate-800/80">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Table Rows Skeleton */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-6 py-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <Skeleton key={cIdx} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
