import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { USER_ROLES } from '../utils/constants.js';

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, currentUser, loading, isSessionExpired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-400">Authenticating VaultCore Session...</p>
        </div>
      </div>
    );
  }

  // If session has expired, allow rendering so the page remains in the background behind SessionExpiredModal
  if (isSessionExpired) {
    return children;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    requiredRole &&
    currentUser?.role !== requiredRole &&
    currentUser?.role !== USER_ROLES.ADMIN
  ) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-8">
        <div className="rounded-full bg-red-500/10 p-4 text-red-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400 max-w-md">
          Your account role (
          <span className="text-brand-400 font-semibold">
            {currentUser?.role || USER_ROLES.CUSTOMER}
          </span>
          ) does not have permission to view this administrative resource.
        </p>
      </div>
    );
  }

  return children;
};
