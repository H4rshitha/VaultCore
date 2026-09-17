import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth.js';
import { USER_ROLES } from '../utils/constants.js';
import { Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export const SignupPage = () => {
  const { signup, isAuthenticated } = useAuth();
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
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: USER_ROLES.CUSTOMER,
    },
  });

  const signupMutation = useMutation({
    mutationFn: async ({ fullName, email, password, role }) => {
      // Split full name into firstName and lastName for backend schema
      const trimmed = fullName.trim();
      const firstSpaceIndex = trimmed.indexOf(' ');
      let firstName = trimmed;
      let lastName = 'User';

      if (firstSpaceIndex > 0) {
        firstName = trimmed.substring(0, firstSpaceIndex).trim();
        lastName = trimmed.substring(firstSpaceIndex + 1).trim() || 'User';
      }

      return await signup({
        firstName,
        lastName,
        email,
        password,
        role: role || USER_ROLES.CUSTOMER,
      });
    },
    onSuccess: () => {
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      // Check for structured backend error details
      const responseData = error.response?.data;
      if (Array.isArray(responseData?.data) || Array.isArray(responseData?.errors)) {
        const errorList = responseData.data || responseData.errors;
        errorList.forEach((err) => {
          if (err.field) {
            const fieldMap = {
              firstName: 'fullName',
              lastName: 'fullName',
              email: 'email',
              password: 'password',
            };
            const mappedField = fieldMap[err.field] || err.field;
            setError(mappedField, { type: 'server', message: err.message });
          }
        });
      }
    },
  });

  const onSubmit = (data) => {
    signupMutation.mutate({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      role: data.role,
    });
  };

  const serverErrorMessage = signupMutation.error
    ? signupMutation.error.response?.data?.message || signupMutation.error.message || 'Registration failed. Please try again.'
    : null;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Open an Account</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Create your VaultCore banking identity to begin transacting.
        </p>
      </div>

      {serverErrorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-red-800 dark:text-red-200">Registration Error</span>
            <span>{serverErrorMessage}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              {...register('fullName', {
                required: 'Full name is required',
                minLength: {
                  value: 2,
                  message: 'Full name must be at least 2 characters',
                },
              })}
              placeholder="Alexander Wright"
              className={`w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border ${
                errors.fullName ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 dark:border-slate-800 focus:border-brand-500'
              } rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
            />
          </div>
          {errors.fullName && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.fullName.message}</p>
          )}
        </div>

        {/* Email Address */}
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              placeholder="alexander@vaultcore.io"
              className={`w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border ${
                errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 dark:border-slate-800 focus:border-brand-500'
              } rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
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

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) =>
                  value === getValues('password') || 'Passwords do not match',
              })}
              placeholder="••••••••••••"
              className={`w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border ${
                errors.confirmPassword ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 dark:border-slate-800 focus:border-brand-500'
              } rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Role / Account Type */}
        <div>
          <label htmlFor="role" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Account Type
          </label>
          <select
            id="role"
            {...register('role')}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value={USER_ROLES.CUSTOMER}>Standard Customer</option>
            <option value={USER_ROLES.TELLER}>Bank Teller</option>
            <option value={USER_ROLES.ADMIN}>System Administrator</option>
          </select>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={signupMutation.isPending}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {signupMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Registering Account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-500 underline underline-offset-2"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
};
