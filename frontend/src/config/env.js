/**
 * Centralized Environment Configuration for VaultCore Frontend.
 *
 * Supports Vite environment variable standard (import.meta.env):
 * - VITE_API_BASE_URL: Base URL for API calls (e.g. https://api.vaultcore.io/api/v1 or /api/v1)
 * - VITE_GATEWAY_URL: Base URL for Gateway (e.g. https://api.vaultcore.io or http://localhost:3000)
 * - VITE_APP_ENV: Application environment ('development' | 'production' | 'staging' | 'test')
 * - VITE_SSE_URL: Real-time Server-Sent Events stream URL
 * - VITE_APP_NAME: Application display name
 */

const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};

// Determine Node/Vite environment
export const APP_ENV = metaEnv.VITE_APP_ENV || metaEnv.MODE || 'development';
export const IS_PROD = APP_ENV === 'production' || metaEnv.PROD === true;
export const IS_DEV = APP_ENV === 'development' || metaEnv.DEV === true;

// App metadata
export const APP_NAME = metaEnv.VITE_APP_NAME || 'VaultCore';

// Resolve Gateway URL
export const GATEWAY_URL = (() => {
  if (metaEnv.VITE_GATEWAY_URL) {
    return metaEnv.VITE_GATEWAY_URL.replace(/\/+$/, '');
  }
  if (metaEnv.VITE_API_BASE_URL) {
    // If API_BASE_URL is e.g. https://api.vaultcore.io/api/v1, strip /api/v1
    return metaEnv.VITE_API_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
  // Development default
  return 'http://localhost:3000';
})();

// Resolve API Base URL
export const API_BASE_URL = (() => {
  if (metaEnv.VITE_API_BASE_URL) {
    return metaEnv.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  if (metaEnv.VITE_GATEWAY_URL) {
    return `${metaEnv.VITE_GATEWAY_URL.replace(/\/+$/, '')}/api/v1`;
  }
  // Development default (matches local Vite proxy / backend API Gateway)
  return 'http://localhost:3000/api/v1';
})();

// Resolve SSE Real-Time Stream URL
export const SSE_URL = (() => {
  if (metaEnv.VITE_SSE_URL) {
    return metaEnv.VITE_SSE_URL;
  }
  // Derive from API_BASE_URL or GATEWAY_URL
  const base = API_BASE_URL.replace(/\/+$/, '');
  return `${base}/events/stream`;
})();

export const config = {
  env: APP_ENV,
  isProd: IS_PROD,
  isDev: IS_DEV,
  appName: APP_NAME,
  gatewayUrl: GATEWAY_URL,
  apiBaseUrl: API_BASE_URL,
  sseUrl: SSE_URL,
};

export default config;
