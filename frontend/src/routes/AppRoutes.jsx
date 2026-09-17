import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';

// Pages
import { LoginPage } from '../pages/LoginPage.jsx';
import { SignupPage } from '../pages/SignupPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { AccountsPage } from '../pages/AccountsPage.jsx';
import { TransferPage } from '../pages/TransferPage.jsx';
import { TransactionsPage } from '../pages/TransactionsPage.jsx';
import { LedgerPage } from '../pages/LedgerPage.jsx';
import { NotificationsPage } from '../pages/NotificationsPage.jsx';
import { AdminPage } from '../pages/AdminPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* Protected Dashboard Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/transfer" element={<TransferPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 Wildcard */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
