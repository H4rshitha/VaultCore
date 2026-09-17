import React from 'react';
import { Spinner } from './Spinner.jsx';

export const Button = React.forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] disabled:active:scale-100';

    const variantClasses = {
      primary:
        'bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/30 focus:ring-brand-500 focus:ring-offset-slate-900 border border-brand-500/30',
      secondary:
        'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm focus:ring-slate-500 focus:ring-offset-slate-900',
      outline:
        'bg-transparent hover:bg-slate-800/60 text-slate-300 border border-slate-700 hover:text-white focus:ring-slate-500 focus:ring-offset-slate-900',
      ghost:
        'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 focus:ring-slate-500 focus:ring-offset-slate-900 border border-transparent',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 focus:ring-rose-500 focus:ring-offset-slate-900 border border-rose-500/30',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-5 py-2.5 text-base gap-2.5',
    };

    const currentVariant = variantClasses[variant] || variantClasses.primary;
    const currentSize = sizeClasses[size] || sizeClasses.md;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${currentVariant} ${currentSize} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Spinner size={size === 'lg' ? 'md' : 'sm'} color="current" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {LeftIcon && <LeftIcon className="w-4 h-4 flex-shrink-0" />}
            <span>{children}</span>
            {RightIcon && <RightIcon className="w-4 h-4 flex-shrink-0" />}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
