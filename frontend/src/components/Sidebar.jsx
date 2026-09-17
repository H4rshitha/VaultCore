import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  ReceiptText,
  BookOpenCheck,
  Bell,
  ShieldCheck,
  Shield,
  Layers,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { USER_ROLES } from '../utils/constants.js';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', path: '/accounts', icon: Wallet },
  { name: 'Money Transfer', path: '/transfer', icon: ArrowLeftRight },
  { name: 'Transactions', path: '/transactions', icon: ReceiptText },
  { name: 'Ledger Audit', path: '/ledger', icon: BookOpenCheck },
  { name: 'Notifications', path: '/notifications', icon: Bell },
  { name: 'Admin Console', path: '/admin', icon: ShieldCheck, role: USER_ROLES.ADMIN },
];

export const Sidebar = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-[#0D1322] border-r border-slate-200 dark:border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 shadow-lg lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/25">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              VaultCore
              <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30">
                PROD
              </span>
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Distributed Banking</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          <div className="px-3 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Core Platform
            </p>
          </div>

          {navItems.map((item) => {
            // If item requires admin and user is not admin, hide or show badge
            if (item.role === USER_ROLES.ADMIN && currentUser?.role !== USER_ROLES.ADMIN) {
              return null;
            }

            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* System & Architecture Info Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/30">
          <div className="rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-300">Cluster Status</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>PostgreSQL & Redis</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                Healthy
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
