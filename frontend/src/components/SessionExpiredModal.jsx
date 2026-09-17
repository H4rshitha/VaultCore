import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, LogIn, LogOut } from 'lucide-react';
import { Modal } from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { clearMemoryAccessToken } from '../utils/storage.js';
import { resetSessionExpiredFlag } from '../api/client.js';

export const SessionExpiredModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { logout, isSessionExpired, clearSessionExpired } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const handleSessionExpired = () => {
      // Don't show modal if already on login/signup page
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/signup')
      ) {
        setIsOpen(true);
      }
    };

    if (
      isSessionExpired &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/signup')
    ) {
      setIsOpen(true);
    }

    window.addEventListener('vaultcore:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('vaultcore:session-expired', handleSessionExpired);
    };
  }, [isSessionExpired]);

  // Login Again: Clear in-memory access token and navigate to /login
  const handleLoginAgain = () => {
    setIsOpen(false);
    clearMemoryAccessToken();
    resetSessionExpiredFlag();
    if (clearSessionExpired) {
      clearSessionExpired();
    }
    navigate('/login', { replace: true });
  };

  // Logout: Clear session, close SSE connection, clear React Query cache, navigate to /login
  const handleLogout = async () => {
    setIsOpen(false);
    resetSessionExpiredFlag();
    if (clearSessionExpired) {
      clearSessionExpired();
    }
    // Clear React Query cache
    queryClient.clear();
    // Clear session & trigger SSE connection close via auth cleanup
    try {
      await logout();
    } catch {
      // Ignore
    }
    navigate('/login', { replace: true });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleLogout}
      title="Session Expired"
      showCloseButton={false}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="secondary" onClick={handleLogout} leftIcon={LogOut}>
            Logout
          </Button>
          <Button variant="primary" onClick={handleLoginAgain} leftIcon={LogIn}>
            Login Again
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-slate-300 font-medium">
            Your authenticated banking session has expired for security purposes or your credentials
            have refreshed.
          </p>
          <p className="text-xs text-slate-400">
            Please authenticate again to resume real-time transactions, account transfers, and audit
            logs.
          </p>
        </div>
      </div>
    </Modal>
  );
};
