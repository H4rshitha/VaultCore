import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  RefreshCw,
  Zap,
  Radio,
  Server,
  Database,
  Cpu,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useCircuitBreakers, useAdminHealth, useMetrics } from '../hooks/useAdmin.js';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError, showLoading, dismissToast } from '../utils/toast.js';
import { SkeletonCard, Skeleton } from '../components/ui/Skeleton.jsx';
import { Button } from '../components/ui/Button.jsx';

export const AdminPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toLocaleTimeString());

  // 15-second polling interval on Admin Dashboard
  const {
    data: circuitBreakersData,
    isLoading: isLoadingCB,
    isError: isErrorCB,
    refetch: refetchCB,
    isFetching: isFetchingCB,
    dataUpdatedAt: cbUpdatedAt,
  } = useCircuitBreakers({ refetchInterval: 15000, refetchOnWindowFocus: true });

  const {
    data: healthData,
    isLoading: isLoadingHealth,
    isError: isErrorHealth,
    refetch: refetchHealth,
    isFetching: isFetchingHealth,
    dataUpdatedAt: healthUpdatedAt,
  } = useAdminHealth({ refetchInterval: 15000, refetchOnWindowFocus: true });

  const {
    data: metricsData,
    isLoading: isLoadingMetrics,
    refetch: refetchMetrics,
    isFetching: isFetchingMetrics,
  } = useMetrics({ refetchInterval: 15000, refetchOnWindowFocus: true });

  useEffect(() => {
    const ts = Math.max(cbUpdatedAt || 0, healthUpdatedAt || 0);
    if (ts > 0) {
      setLastUpdated(new Date(ts).toLocaleTimeString());
    }
  }, [cbUpdatedAt, healthUpdatedAt]);

  const isGlobalFetching = isFetchingCB || isFetchingHealth || isFetchingMetrics;

  const handleManualRefreshAll = async () => {
    const toastId = showLoading('Refreshing cluster telemetry...');
    try {
      await Promise.all([refetchCB(), refetchHealth(), refetchMetrics()]);
      dismissToast(toastId);
      showSuccess('Admin telemetry refreshed.');
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      dismissToast(toastId);
      showError('Failed to refresh telemetry.');
    }
  };

  // 1. Role Authorization Check: Only users with ADMIN role can view console
  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="p-8 sm:p-12 rounded-2xl bg-red-950/20 border border-red-800/60 text-center max-w-lg mx-auto my-12 backdrop-blur-xl">
        <div className="h-16 w-16 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
        <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
          Your current authenticated session (
          <span className="font-mono text-brand-400">{currentUser?.email}</span>) has the role{' '}
          <strong className="text-white uppercase">{currentUser?.role || 'CUSTOMER'}</strong>.
          Access to the Admin & Circuit Breaker console requires{' '}
          <strong className="text-red-300">ADMIN</strong> privileges.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Parse Circuit Breaker Services
  const cbServices = circuitBreakersData || {};
  const breakersList = [
    {
      id: 'ledger',
      name: 'Ledger Service',
      desc: 'Double-entry journal entries & account transactions',
      data: cbServices.ledger ||
        cbServices['ledger-service'] || {
          state: 'CLOSED',
          failureCount: 0,
          failFastCount: 0,
          recoveryCount: 0,
          lastStateChange: new Date().toISOString(),
        },
    },
    {
      id: 'rabbitmq',
      name: 'RabbitMQ Publisher',
      desc: 'Asynchronous event bus and message broker',
      data: cbServices.rabbitmq ||
        cbServices['rabbitmq-publisher'] || {
          state: 'CLOSED',
          failureCount: 0,
          failFastCount: 0,
          recoveryCount: 0,
          lastStateChange: new Date().toISOString(),
        },
    },
    {
      id: 'notification',
      name: 'Notification Service',
      desc: 'Multi-channel email & SMS worker queue',
      data: cbServices.notification ||
        cbServices['notification-service'] || {
          state: 'CLOSED',
          failureCount: 0,
          failFastCount: 0,
          recoveryCount: 0,
          lastStateChange: new Date().toISOString(),
        },
    },
  ];

  // Helper for Circuit Breaker State Chips
  const getCircuitStateChip = (state = 'CLOSED') => {
    const s = String(state).toUpperCase();
    if (s === 'CLOSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
          <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          CLOSED
        </span>
      );
    }
    if (s === 'HALF_OPEN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
          HALF_OPEN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold">
        <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse"></span>
        OPEN (Failing Fast)
      </span>
    );
  };

  // Readiness Dependencies List
  const readinessDeps = healthData?.readiness?.checks || {
    gateway: { status: 'UP' },
    postgres: { status: 'UP' },
    redis: { status: 'UP' },
    rabbitmq: { status: 'UP' },
    authService: { status: 'UP' },
    accountService: { status: 'UP' },
    paymentService: { status: 'UP' },
    ledgerService: { status: 'UP' },
    notificationService: { status: 'UP' },
  };

  const getServiceStatusDisplay = (status = 'UP') => {
    const s = String(status).toUpperCase();
    if (['UP', 'HEALTHY', 'READY', 'ACTIVE'].includes(s)) {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        textClass: 'text-emerald-600 dark:text-emerald-400',
        label: s === 'UP' ? 'Healthy' : s === 'READY' ? 'Healthy' : s,
      };
    }
    if (['DEGRADED', 'WARN', 'SLOW', 'HALF_OPEN'].includes(s)) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        textClass: 'text-amber-600 dark:text-amber-400',
        label: 'Degraded',
      };
    }
    return {
      icon: <XCircle className="w-4 h-4 text-red-500" />,
      textClass: 'text-red-600 dark:text-red-400',
      label: 'Down',
    };
  };

  return (
    <div className="space-y-8">
      {/* 1. Header & Live Telemetry Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold tracking-wider uppercase">
              <ShieldAlert className="w-3.5 h-3.5" />
              Admin Console
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Auto-refresh: 15s (Last: {lastUpdated})</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            System Resilience & Observability
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time circuit breaker telemetry, Prometheus cluster metrics, and infrastructure
            health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefreshAll}
            disabled={isGlobalFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isGlobalFetching ? 'animate-spin text-brand-500 dark:text-brand-400' : ''}`}
            />
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {/* 2. Prometheus Summary Metrics Cards */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          Prometheus Gateway Telemetry
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total HTTP Requests */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Total HTTP Requests
              </span>
              <Activity className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isLoadingMetrics
                ? '—'
                : metricsData?.httpRequestsTotal !== undefined &&
                    metricsData?.httpRequestsTotal !== 'Unavailable'
                  ? typeof metricsData.httpRequestsTotal === 'number'
                    ? metricsData.httpRequestsTotal.toLocaleString()
                    : metricsData.httpRequestsTotal
                  : 'Unavailable'}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              Gateway Ingress
            </p>
          </div>

          {/* Card 2: HTTP Errors */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                HTTP 4xx / 5xx Errors
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isLoadingMetrics
                ? '—'
                : metricsData?.httpErrorsTotal !== undefined &&
                    metricsData?.httpErrorsTotal !== 'Unavailable'
                  ? typeof metricsData.httpErrorsTotal === 'number'
                    ? metricsData.httpErrorsTotal.toLocaleString()
                    : metricsData.httpErrorsTotal
                  : 'Unavailable'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Error Response Rate
            </p>
          </div>

          {/* Card 3: Active Requests */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Active Requests
              </span>
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isLoadingMetrics
                ? '—'
                : metricsData?.httpActiveRequests !== undefined &&
                    metricsData?.httpActiveRequests !== 'Unavailable'
                  ? typeof metricsData.httpActiveRequests === 'number'
                    ? metricsData.httpActiveRequests.toLocaleString()
                    : metricsData.httpActiveRequests
                  : 'Unavailable'}
            </p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
              In-Flight Concurrency
            </p>
          </div>

          {/* Card 4: Rate Limiting Blocks */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Rate Limit Blocked
              </span>
              <Lock className="w-4 h-4 text-red-500 dark:text-red-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isLoadingMetrics
                ? '—'
                : metricsData?.rateLimitBlockedTotal !== undefined &&
                    metricsData?.rateLimitBlockedTotal !== 'Unavailable'
                  ? typeof metricsData.rateLimitBlockedTotal === 'number'
                    ? metricsData.rateLimitBlockedTotal.toLocaleString()
                    : metricsData.rateLimitBlockedTotal
                  : 'Unavailable'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Redis Sliding Window Quota
            </p>
          </div>
        </div>
      </div>

      {/* 3. Downstream Circuit Breakers Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Downstream Circuit Breakers
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Threshold: 5 fails | Timeout: 30s
          </span>
        </div>

        {isLoadingCB ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} rows={3} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {breakersList.map((breaker) => (
              <div
                key={breaker.id}
                className="p-6 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {breaker.name}
                    </h3>
                    {getCircuitStateChip(breaker.data.state)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{breaker.desc}</p>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Failure Count</span>
                      <span className="font-mono text-slate-900 dark:text-white font-semibold">
                        {breaker.data.failureCount ?? 0} / 5
                      </span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Fail-Fast Count</span>
                      <span className="font-mono text-slate-900 dark:text-white font-semibold">
                        {breaker.data.failFastCount ?? 0}
                      </span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Recovery Count</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {breaker.data.recoveryCount ?? 0}
                      </span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Last Transition</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                        {breaker.data.lastStateChange
                          ? new Date(breaker.data.lastStateChange).toLocaleTimeString()
                          : 'Initialized'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Cluster & Infrastructure Health */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Infrastructure & Microservice Health
        </h2>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              {
                label: 'Gateway Node',
                status: healthData?.overview?.status || (isLoadingHealth ? '—' : 'HEALTHY'),
                type: 'Ingress',
              },
              {
                label: 'PostgreSQL DB',
                status:
                  healthData?.readiness?.infrastructure?.postgres?.status ||
                  (isLoadingHealth ? '—' : 'UP'),
                type: 'Storage',
              },
              {
                label: 'Redis DB0',
                status:
                  healthData?.readiness?.infrastructure?.redis?.status ||
                  (isLoadingHealth ? '—' : 'UP'),
                type: 'Cache/Lock',
              },
              {
                label: 'RabbitMQ',
                status:
                  healthData?.readiness?.infrastructure?.rabbitmq?.status ||
                  (isLoadingHealth ? '—' : 'UP'),
                type: 'Event Bus',
              },
              {
                label: 'Auth Service',
                status:
                  healthData?.readiness?.microservices?.auth?.status ||
                  (isLoadingHealth ? '—' : 'UP'),
                type: 'JWT',
              },
              {
                label: 'Account Service',
                status:
                  healthData?.readiness?.microservices?.account?.status ||
                  (isLoadingHealth ? '—' : 'UP'),
                type: 'Core',
              },
              {
                label: 'Payment Service',
                status:
                  healthData?.readiness?.microservices?.payment?.status ||
                  (isLoadingHealth ? '—' : 'UP'),
                type: 'Transfers',
              },
              {
                label: 'Ledger Service',
                status:
                  healthData?.readiness?.microservices?.ledger?.status ||
                  (isLoadingHealth ? '—' : 'UP'),
                type: 'ACID',
              },
              {
                label: 'Notification',
                status:
                  healthData?.readiness?.microservices?.notification?.status ||
                  (isLoadingHealth ? '—' : 'UP'),
                type: 'Queue',
              },
              {
                label: 'Outbox Worker',
                status: healthData?.outbox?.status
                  ? 'ACTIVE'
                  : healthData?.readiness?.microservices?.payment?.status === 'UP'
                    ? 'ACTIVE'
                    : 'DEGRADED',
                type: 'Cron',
              },
            ].map((dep) => {
              const display = getServiceStatusDisplay(dep.status);
              return (
                <div
                  key={dep.label}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                      {dep.type}
                    </span>
                    {display.icon}
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {dep.label}
                  </p>
                  <span className={`text-[11px] font-medium mt-1 ${display.textClass}`}>
                    {display.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
