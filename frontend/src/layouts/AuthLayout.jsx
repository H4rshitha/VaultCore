import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Shield, Lock } from 'lucide-react';

export const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-brand-600/10 dark:from-brand-600/15 via-indigo-600/5 dark:via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-xl shadow-brand-500/25">
              <Shield className="h-7 w-7" />
            </div>
          </Link>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          VaultCore
        </h2>
        <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
          Distributed Enterprise Banking Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 backdrop-blur-xl py-8 px-6 shadow-xl dark:shadow-2xl rounded-2xl sm:px-10">
          <Outlet />
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>End-to-End Encrypted &bull; Distributed Rate Limited</span>
        </div>
      </div>
    </div>
  );
};
