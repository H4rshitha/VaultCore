import React, { useState } from 'react';
import { Menu, LogOut, User, Activity, Bell, Radio, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useUnreadCount } from '../hooks/useNotifications.js';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents.js';
import { useTheme } from '../hooks/useTheme.js';
import { useNavigate } from 'react-router-dom';
import { USER_ROLES } from '../utils/constants.js';
import { APP_NAME } from '../utils/env.js';

export const TopNavbar = ({ onOpenSidebar }) => {
  const { currentUser, logout } = useAuth();
  const { unreadCount } = useUnreadCount();
  const { connected, connectionStatus, reconnect } = useRealtimeEvents();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getInitials = () => {
    if (currentUser?.firstName && currentUser?.lastName) {
      return `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.substring(0, 2).toUpperCase();
    }
    return 'VC';
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-[#0D1322]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 flex items-center justify-between transition-colors duration-200">
      {/* Left side: Mobile menu toggle & Gateway Status */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden focus:outline-none transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Gateway:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
            api.vaultcore.local
          </span>
        </div>
      </div>

      {/* Right side: Realtime SSE Status, Notifications, User Profile & Logout */}
      <div className="flex items-center gap-3">
        {/* Real-time SSE Live Connection Indicator */}
        <button
          onClick={connectionStatus !== 'CONNECTED' ? reconnect : undefined}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
            connectionStatus === 'CONNECTED'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 shadow-sm'
              : connectionStatus === 'RECONNECTING'
              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 animate-pulse'
              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20'
          }`}
          title={
            connectionStatus === 'CONNECTED'
              ? 'Real-Time SSE Connected: Banking events streaming live'
              : connectionStatus === 'RECONNECTING'
              ? 'Reconnecting to live banking event stream...'
              : 'Offline - Click to reconnect real-time stream'
          }
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                : connectionStatus === 'RECONNECTING'
                ? 'bg-amber-500 dark:bg-amber-400 animate-ping'
                : 'bg-rose-500 dark:bg-rose-400'
            }`}
          />
          <span className="font-semibold text-[11px] capitalize">
            {connectionStatus === 'CONNECTED'
              ? 'Live'
              : connectionStatus === 'RECONNECTING'
              ? 'Reconnecting'
              : 'Offline'}
          </span>
        </button>

        {/* Gateway Health Indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Activity className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 animate-pulse" />
          <span>X-Trace Live</span>
        </div>

        {/* Notifications Quick Link */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Notifications"
          title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'Notifications'}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#0D1322] shadow-sm animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600"></span>
          )}
        </button>

        {/* Theme Toggle (Dark / Light) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* User Avatar & Info */}
        <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-brand-500/20 ring-2 ring-slate-200 dark:ring-slate-800">
              {getInitials()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                {currentUser?.firstName
                  ? `${currentUser.firstName} ${currentUser.lastName || ''}`
                  : currentUser?.email || 'User Session'}
              </p>
              <p className="text-[10px] text-brand-600 dark:text-brand-400 font-medium uppercase tracking-wider">
                {currentUser?.role || USER_ROLES.CUSTOMER}
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-colors"
            title={`Logout from ${APP_NAME || 'VaultCore'}`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isLoggingOut ? 'Exiting...' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
