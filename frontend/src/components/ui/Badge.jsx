import React from 'react';

export const Badge = ({
  children,
  variant = 'brand',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variantClasses = {
    brand: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    neutral: 'bg-slate-800/80 text-slate-300 border-slate-700',
  };

  const dotClasses = {
    brand: 'bg-brand-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    purple: 'bg-purple-400',
    neutral: 'bg-slate-400',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  const currentVariant = variantClasses[variant] || variantClasses.brand;
  const currentDot = dotClasses[variant] || dotClasses.brand;
  const currentSize = sizeClasses[size] || sizeClasses.md;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${currentVariant} ${currentSize} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${currentDot}`} />}
      {children}
    </span>
  );
};
