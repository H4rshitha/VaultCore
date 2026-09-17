import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/adminApi.js';

/**
 * Parses Prometheus raw text format into structured key-value summary metrics.
 * Gracefully handles missing metrics with "Unavailable" instead of zero.
 */
export function parsePrometheusText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return {
      httpRequestsTotal: 'Unavailable',
      httpErrorsTotal: 'Unavailable',
      httpActiveRequests: 'Unavailable',
      rateLimitAllowedTotal: 'Unavailable',
      rateLimitBlockedTotal: 'Unavailable',
      raw: '',
    };
  }

  let foundRequests = false;
  let foundErrors = false;
  let foundActive = false;
  let foundBlocked = false;

  let httpRequestsTotal = 0;
  let httpErrorsTotal = 0;
  let httpActiveRequests = 0;
  let rateLimitAllowedTotal = 0;
  let rateLimitBlockedTotal = 0;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;

    const parts = trimmed.split(/\s+/);
    const val = parseFloat(parts[parts.length - 1]);
    if (isNaN(val)) continue;

    if (trimmed.startsWith('vaultcore_http_requests_total')) {
      httpRequestsTotal += val;
      foundRequests = true;
    } else if (trimmed.startsWith('vaultcore_http_errors_total')) {
      httpErrorsTotal += val;
      foundErrors = true;
    } else if (trimmed.startsWith('vaultcore_http_active_requests')) {
      httpActiveRequests += val;
      foundActive = true;
    } else if (trimmed.startsWith('vaultcore_rate_limit_allowed_total')) {
      rateLimitAllowedTotal += val;
    } else if (trimmed.startsWith('vaultcore_rate_limit_blocked_total')) {
      rateLimitBlockedTotal += val;
      foundBlocked = true;
    }
  }

  return {
    httpRequestsTotal: foundRequests ? httpRequestsTotal : 'Unavailable',
    httpErrorsTotal: foundErrors ? httpErrorsTotal : (foundRequests ? 0 : 'Unavailable'),
    httpActiveRequests: foundActive ? httpActiveRequests : 'Unavailable',
    rateLimitAllowedTotal,
    rateLimitBlockedTotal: foundBlocked ? rateLimitBlockedTotal : (foundRequests ? 0 : 'Unavailable'),
    raw: text,
  };
}

/**
 * Hook to retrieve state and telemetry for downstream circuit breakers.
 */
export const useCircuitBreakers = (options = {}) => {
  return useQuery({
    queryKey: ['admin', 'circuit-breakers'],
    queryFn: async () => {
      const res = await adminApi.getCircuitBreakers();
      return res?.data || res;
    },
    staleTime: 10000,
    retry: (failureCount, error) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 1;
    },
    refetchInterval: (query) => {
      if (query?.state?.error) return false;
      return 15000;
    },
    refetchOnWindowFocus: true,
    ...options,
  });
};

/**
 * Hook to retrieve Gateway health and dependency readiness.
 */
export const useAdminHealth = (options = {}) => {
  return useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const [overviewRes, readinessRes, outboxRes, notifRes] = await Promise.allSettled([
        adminApi.getHealth(),
        adminApi.getReadiness(),
        adminApi.getOutboxStatus(),
        adminApi.getNotificationStatus(),
      ]);

      const overview = overviewRes.status === 'fulfilled' ? overviewRes.value?.data || overviewRes.value : {};
      const readiness = readinessRes.status === 'fulfilled' ? readinessRes.value?.data || readinessRes.value : {};
      const outbox = outboxRes.status === 'fulfilled' ? outboxRes.value?.data || outboxRes.value : {};
      const notification = notifRes.status === 'fulfilled' ? notifRes.value?.data || notifRes.value : {};

      return {
        overview,
        readiness,
        outbox,
        notification,
        isReady: readiness?.status === 'READY',
      };
    },
    staleTime: 10000,
    retry: (failureCount, error) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 1;
    },
    refetchInterval: (query) => {
      if (query?.state?.error) return false;
      return 15000;
    },
    refetchOnWindowFocus: true,
    ...options,
  });
};

/**
 * Hook to retrieve Prometheus metrics.
 */
export const useMetrics = (options = {}) => {
  return useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: async () => {
      const res = await adminApi.getMetrics();
      const rawText = typeof res === 'string' ? res : (res?.data || '');
      return parsePrometheusText(rawText);
    },
    staleTime: 10000,
    retry: (failureCount, error) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 1;
    },
    refetchInterval: (query) => {
      if (query?.state?.error) return false;
      return 15000;
    },
    refetchOnWindowFocus: true,
    ...options,
  });
};
