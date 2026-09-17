import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, LogIn } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';

export const NotFoundPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
      <div className="max-w-md w-full bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-lg shadow-amber-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold mb-3">
            <span>HTTP 404</span>
            <span>•</span>
            <span>Not Found</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Page Not Found</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            The requested VaultCore microservice route or resource does not exist or has been relocated.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isAuthenticated ? (
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button variant="primary" leftIcon={LayoutDashboard} className="w-full">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="w-full sm:w-auto">
                <Button variant="primary" leftIcon={LogIn} className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link to="/dashboard" className="w-full sm:w-auto">
                <Button variant="secondary" leftIcon={LayoutDashboard} className="w-full">
                  Dashboard
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
