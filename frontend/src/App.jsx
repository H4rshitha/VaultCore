import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext.jsx';
import { RealtimeProvider } from './context/RealtimeContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { SessionExpiredModal } from './components/SessionExpiredModal.jsx';
import { DevInspector } from './components/DevInspector.jsx';
import { AppRoutes } from './routes/AppRoutes.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

export const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              <BrowserRouter>
                <AppRoutes />
                <SessionExpiredModal />
                <DevInspector />
                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #1e293b',
                      borderRadius: '0.75rem',
                      fontSize: '0.875rem',
                      padding: '12px 16px',
                      boxShadow:
                        '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                    },
                    success: {
                      iconTheme: {
                        primary: '#3b82f6',
                        secondary: '#0f172a',
                      },
                      duration: 4000,
                    },
                    error: {
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#0f172a',
                      },
                      duration: 5000,
                    },
                    loading: {
                      iconTheme: {
                        primary: '#60a5fa',
                        secondary: '#0f172a',
                      },
                    },
                  }}
                />
              </BrowserRouter>
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
