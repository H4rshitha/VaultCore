import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth.js';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }) => {
      return await login(email, password);
    },
    onSuccess: () => {
      navigate(from, { replace: true });
    },
    onError: (error) => {
      // Check if backend returned structured field errors
      const responseData = error.response?.data;
      if (Array.isArray(responseData?.data) || Array.isArray(responseData?.errors)) {
        const errorList = responseData.data || responseData.errors;
        errorList.forEach((err) => {
          if (err.field && (err.field === 'email' || err.field === 'password')) {
            setError(err.field, { type: 'server', message: err.message });
          }
        });
      }
    },
  });

  const onSubmit = (data) => {
    loginMutation.mutate({
      email: data.email,
      password: data.password,
    });
  };

  const serverErrorMessage = loginMutation.error
    ? loginMutation.error.response?.data?.message || loginMutation.error.message || 'Authentication failed. Please verify your credentials.'
    : null;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sign In</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Enter your credentials to access your VaultCore banking portal.
        </p>
      </div>

      {serverErrorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-red-800 dark:text-red-200">Authentication Error</span>
            <span>{serverErrorMessage}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email', {
                required: 'Email address is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Enter a valid email address',
                },
              })}
              placeholder="name@vaultcore.io"
              className={`w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border ${
                errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 dark:border-slate-800 focus:border-brand-500'
              } rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <span className="text-[11px] text-brand-600 dark:text-brand-400 hover:text-brand-500 cursor-pointer">
              Forgot password?
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password', {
                required: 'Password is required',
              })}
              placeholder="••••••••••••"
              className={`w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border ${
                errors.password ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 dark:border-slate-800 focus:border-brand-500'
              } rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-4 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loginMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Don't have an account?{' '}
        <Link
          to="/signup"
          className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-500 underline underline-offset-2"
        >
          Create an Account
        </Link>
      </div>
    </div>
  );
};
