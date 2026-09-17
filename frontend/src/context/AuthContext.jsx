import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { storage, setMemoryAccessToken, clearMemoryAccessToken } from '../utils/storage.js';
import { authApi } from '../api/authApi.js';
import { apiClient, resetSessionExpiredFlag } from '../api/client.js';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => storage.getUser());
  const [accessToken, setAccessToken] = useState(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  // Listen for global session expired event dispatched by Axios interceptor
  useEffect(() => {
    const handleSessionExpired = () => {
      setIsSessionExpired(true);
      setAccessToken(null);
      clearMemoryAccessToken();
      delete apiClient.defaults.headers.common.Authorization;
    };

    window.addEventListener('vaultcore:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('vaultcore:session-expired', handleSessionExpired);
    };
  }, []);

  // Initialize and verify existing session on mount via refresh token
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const savedUser = storage.getUser();
      if (savedUser && isMounted) {
        setCurrentUser(savedUser);
      }

      try {
        // Attempt silent session restore / refresh via HTTP-only cookie
        const res = await authApi.refreshToken();
        const data = res?.data || res;
        const newToken = data.tokens?.accessToken || data.accessToken || data.token;
        const user = data.user || savedUser;

        if (newToken && isMounted) {
          setMemoryAccessToken(newToken);
          setAccessToken(newToken);
          setIsSessionExpired(false);
          resetSessionExpiredFlag();
          apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;

          if (user) {
            storage.setUser(user);
            setCurrentUser(user);
          }
        } else if (!newToken) {
          throw new Error('No access token received on session restore');
        }
      } catch {
        if (isMounted) {
          clearMemoryAccessToken();
          setAccessToken(null);
          delete apiClient.defaults.headers.common.Authorization;

          // If a user was previously logged in but refresh failed, set session expired
          if (savedUser) {
            setIsSessionExpired(true);
          } else {
            storage.clearUser();
            setCurrentUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      const data = response?.data || response;
      const token = data.tokens?.accessToken || data.accessToken || data.token;
      const user = data.user || { email, role: data.role || 'CUSTOMER' };

      if (token) {
        setMemoryAccessToken(token);
        setAccessToken(token);
        setIsSessionExpired(false);
        resetSessionExpiredFlag();
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
      }

      if (user) {
        storage.setUser(user);
        setCurrentUser(user);
      }

      return { success: true, user, token };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (userData) => {
    setLoading(true);
    try {
      const response = await authApi.signup(userData);
      const data = response?.data || response;
      const token = data.tokens?.accessToken || data.accessToken || data.token;
      const user = data.user || {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'CUSTOMER',
      };

      if (token) {
        setMemoryAccessToken(token);
        setAccessToken(token);
        setIsSessionExpired(false);
        resetSessionExpiredFlag();
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
      }

      if (user) {
        storage.setUser(user);
        setCurrentUser(user);
      }

      return { success: true, user, token };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Signup failed';
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authApi.logout();
    } catch {
      // Ignore logout backend errors
    } finally {
      clearMemoryAccessToken();
      storage.clearUser();
      setCurrentUser(null);
      setAccessToken(null);
      setIsSessionExpired(false);
      resetSessionExpiredFlag();
      delete apiClient.defaults.headers.common.Authorization;
      setLoading(false);
    }
  }, []);

  const refreshTokenHandler = useCallback(async () => {
    try {
      const response = await authApi.refreshToken();
      const data = response?.data || response;
      const newToken = data.tokens?.accessToken || data.accessToken || data.token;
      const user = data.user;

      if (newToken) {
        setMemoryAccessToken(newToken);
        setAccessToken(newToken);
        setIsSessionExpired(false);
        resetSessionExpiredFlag();
        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;

        if (user) {
          storage.setUser(user);
          setCurrentUser(user);
        }
      }
      return newToken;
    } catch (error) {
      clearMemoryAccessToken();
      setAccessToken(null);
      setIsSessionExpired(true);
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      accessToken,
      loading,
      isAuthenticated: Boolean(accessToken),
      isSessionExpired,
      setIsSessionExpired,
      clearSessionExpired: () => setIsSessionExpired(false),
      login,
      signup,
      logout,
      refreshToken: refreshTokenHandler,
      setCurrentUser,
    }),
    [
      currentUser,
      accessToken,
      loading,
      isSessionExpired,
      login,
      signup,
      logout,
      refreshTokenHandler,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
