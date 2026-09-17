import React from 'react';
import { AlertOctagon, RefreshCw, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/Button.jsx';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[VaultCore Error Boundary caught an error]:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/10">
              <AlertOctagon className="w-7 h-7" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                System Safeguard
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-3">
                Unexpected Application Error
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 leading-relaxed">
                VaultCore caught an unhandled rendering error. Your financial data and active sessions remain secure.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-left overflow-x-auto max-h-36 text-xs text-rose-700 dark:text-rose-300 font-mono">
                <p className="font-semibold">{this.state.error.toString()}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={this.handleRetry}
                leftIcon={RefreshCw}
                className="w-full sm:w-auto"
              >
                Retry Application
              </Button>
              <Button
                variant="secondary"
                onClick={this.handleGoDashboard}
                leftIcon={LayoutDashboard}
                className="w-full sm:w-auto"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
