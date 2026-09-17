import axios from 'axios';
import { generateTraceId } from '../utils/trace.js';
import {
  getMemoryAccessToken,
  setMemoryAccessToken,
  clearMemoryAccessToken,
  storage,
} from '../utils/storage.js';
import { API_BASE_URL } from '../utils/env.js';

// Global Event Emitter for Developer Request Inspector
export const requestInspectorEmitter = {
  listeners: new Set(),
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  emit(entry) {
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (err) {
        console.error('[RequestInspector] Error in listener:', err);
      }
    });
  },
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];
let isSessionExpiredActive = false;

export const resetSessionExpiredFlag = () => {
  isSessionExpiredActive = false;
};

if (typeof window !== 'undefined') {
  window.addEventListener('vaultcore:reset-session-expired', () => {
    isSessionExpiredActive = false;
  });
}

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach Bearer Token, X-Trace-ID, and start timestamp
apiClient.interceptors.request.use(
  (config) => {
    const token = getMemoryAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach or preserve X-Trace-ID
    if (!config.headers['X-Trace-ID'] && !config.headers['x-trace-id']) {
      config.headers['X-Trace-ID'] = generateTraceId();
    }

    config._startTime = Date.now();
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper to calculate exponential backoff delay (500ms -> 1000ms)
const getRetryDelay = (retryCount) => {
  return 500 * Math.pow(2, retryCount - 1);
};

// Response Interceptor: Handles GET retries, 401 refresh, and dev inspector telemetry
apiClient.interceptors.response.use(
  (response) => {
    // Record telemetry for Developer Inspector
    const config = response.config || {};
    const responseTime = config._startTime ? Date.now() - config._startTime : undefined;
    const traceId =
      response.headers?.['x-trace-id'] ||
      config.headers?.['X-Trace-ID'] ||
      config.headers?.['x-trace-id'];

    requestInspectorEmitter.emit({
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      traceId: traceId || 'N/A',
      responseTime:
        responseTime !== undefined
          ? `${responseTime}ms`
          : response.headers?.['x-response-time'] || 'N/A',
      responseTimeMs: responseTime,
      method: (config.method || 'GET').toUpperCase(),
      url: config.url || '',
      status: response.status,
      timestamp: new Date().toISOString(),
      ok: true,
      error: false,
    });

    return response;
  },
  async (error) => {
    const originalRequest = error.config || {};
    const method = (originalRequest.method || 'GET').toUpperCase();

    // Record error telemetry for Developer Inspector
    const responseTime = originalRequest._startTime
      ? Date.now() - originalRequest._startTime
      : undefined;
    const traceId =
      error.response?.headers?.['x-trace-id'] ||
      originalRequest.headers?.['X-Trace-ID'] ||
      originalRequest.headers?.['x-trace-id'];

    requestInspectorEmitter.emit({
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      traceId: traceId || 'N/A',
      responseTime:
        responseTime !== undefined
          ? `${responseTime}ms`
          : error.response?.headers?.['x-response-time'] || 'N/A',
      responseTimeMs: responseTime,
      method,
      url: originalRequest.url || '',
      status: error.response?.status || (error.code === 'ECONNABORTED' ? 408 : 0),
      timestamp: new Date().toISOString(),
      ok: false,
      error: true,
    });

    // 1. Axios Retry Policy: Retry GET requests only, max 2 retries (3 attempts total) with exponential backoff (500ms -> 1000ms)
    // Retry only for network errors and HTTP 500-599. Never retry POST, PUT, PATCH, DELETE or 4xx (400, 401, 403, 404, etc.)
    const isGetRequest = method === 'GET';
    const status = error.response?.status;
    const isNetworkError =
      !status ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('timeout');
    const is5xxError = typeof status === 'number' && status >= 500 && status <= 599;
    const isRetryableError = isNetworkError || is5xxError;

    if (isGetRequest && isRetryableError) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const MAX_RETRIES = 2;

      if (originalRequest._retryCount <= MAX_RETRIES) {
        const delay = getRetryDelay(originalRequest._retryCount);
        console.warn(
          `[Axios Retry] Retrying GET ${originalRequest.url} (Attempt ${originalRequest._retryCount}/${MAX_RETRIES}) in ${delay}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return apiClient(originalRequest);
      }
    }

    // 2. Skip refresh logic for auth endpoints
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/signup')
    ) {
      return Promise.reject(error);
    }

    // If the refresh endpoint itself failed with 401, dispatch session-expired
    if (originalRequest.url?.includes('/auth/refresh')) {
      if (error.response?.status === 401) {
        clearMemoryAccessToken();
        if (!isSessionExpiredActive) {
          isSessionExpiredActive = true;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vaultcore:session-expired'));
          }
        }
      }
      return Promise.reject(error);
    }

    // If session expired modal is already active, ignore repeated 401s
    if (error.response?.status === 401 && isSessionExpiredActive) {
      return Promise.reject(error);
    }

    // 3. Handle 401 & Automatic Refresh via HTTP-only cookie
    if (error.response?.status === 401 && !originalRequest._authRetried) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._authRetried = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
              'X-Trace-ID': generateTraceId(),
            },
            timeout: 10000,
          }
        );

        const data = response.data?.data || response.data;
        const newAccessToken = data.tokens?.accessToken || data.accessToken || data.token;

        if (newAccessToken) {
          setMemoryAccessToken(newAccessToken);
          isSessionExpiredActive = false;
          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        } else {
          throw new Error('No access token in refresh response');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearMemoryAccessToken();

        // Dispatch session expired event so SessionExpiredModal can display gracefully
        if (!isSessionExpiredActive) {
          isSessionExpiredActive = true;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vaultcore:session-expired'));
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
