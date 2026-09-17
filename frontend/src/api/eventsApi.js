/**
 * Server-Sent Events (SSE) Client for VaultCore Real-Time Banking Events.
 *
 * Production hardening enhancements:
 * 1. Last-Event-ID resume support across reconnections via URL parameter / standard EventSource.
 * 2. Heartbeat watchdog: 45-second inactivity timeout triggers automated connection recovery.
 * 3. Accurate SSE protocol compliance: Native browser EventSource uses withCredentials cookies
 *    and query parameters rather than custom HTTP request headers for correlation.
 */

const getEventStreamUrl = () => {
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (envUrl) {
    const base = envUrl.replace(/\/+$/, '');
    return `${base}/events/stream`;
  }
  return 'http://localhost:3000/api/v1/events/stream';
};

export class EventStreamClient {
  constructor(options = {}) {
    this.baseUrl = options.url || getEventStreamUrl();
    this.onEvent = options.onEvent || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onError = options.onError || (() => {});

    this.eventSource = null;
    this.status = 'OFFLINE'; // 'CONNECTED' | 'RECONNECTING' | 'OFFLINE'
    this.lastEventId = null;
    this.lastHeartbeatTimestamp = Date.now();
    this.heartbeatWatchdogTimer = null;
    this.heartbeatTimeoutMs = 45000; // 45 seconds without events/ping triggers reconnect

    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.baseDelayMs = 1000;
    this.maxDelayMs = 30000;
    this.reconnectTimer = null;
    this.isManuallyClosed = false;
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.onStatusChange(newStatus);
    }
  }

  getStatus() {
    return this.status;
  }

  recordHeartbeat() {
    this.lastHeartbeatTimestamp = Date.now();
  }

  startHeartbeatWatchdog() {
    this.stopHeartbeatWatchdog();
    this.recordHeartbeat();

    this.heartbeatWatchdogTimer = setInterval(() => {
      if (this.isManuallyClosed || this.status !== 'CONNECTED') return;

      const elapsed = Date.now() - this.lastHeartbeatTimestamp;
      if (elapsed > this.heartbeatTimeoutMs) {
        console.warn(`[SSE] Heartbeat timeout (${elapsed}ms > ${this.heartbeatTimeoutMs}ms). Recovering connection...`);
        this.setStatus('OFFLINE');
        this.cleanupEventSource();
        this.scheduleReconnect(true); // Immediate reconnect
      }
    }, 5000);
  }

  stopHeartbeatWatchdog() {
    if (this.heartbeatWatchdogTimer) {
      clearInterval(this.heartbeatWatchdogTimer);
      this.heartbeatWatchdogTimer = null;
    }
  }

  buildStreamUrl() {
    try {
      const url = new URL(this.baseUrl, window?.location?.origin || 'http://localhost:3000');
      if (this.lastEventId) {
        url.searchParams.set('lastEventId', this.lastEventId);
      }
      return url.toString();
    } catch {
      if (this.lastEventId) {
        const sep = this.baseUrl.includes('?') ? '&' : '?';
        return `${this.baseUrl}${sep}lastEventId=${encodeURIComponent(this.lastEventId)}`;
      }
      return this.baseUrl;
    }
  }

  connect() {
    this.isManuallyClosed = false;
    this.cleanupEventSource();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'OFFLINE');
      const connectionUrl = this.buildStreamUrl();
      this.eventSource = new EventSource(connectionUrl, { withCredentials: true });

      this.startHeartbeatWatchdog();

      this.eventSource.onopen = () => {
        const wasReconnecting = this.reconnectAttempts > 0;
        this.reconnectAttempts = 0;
        this.recordHeartbeat();
        this.setStatus('CONNECTED');
        if (wasReconnecting) {
          this.onEvent({ type: 'connection.restored', timestamp: new Date().toISOString() });
        }
      };

      this.eventSource.onmessage = (e) => {
        this.recordHeartbeat();

        // Track standard EventSource lastEventId
        if (e.lastEventId) {
          this.lastEventId = e.lastEventId;
        }

        if (!e.data || e.data === ': keepalive' || e.data.startsWith(':')) {
          return;
        }

        try {
          const parsed = JSON.parse(e.data);
          if (parsed.eventId || parsed.id) {
            this.lastEventId = parsed.eventId || parsed.id;
          }
          this.onEvent(parsed);
        } catch (err) {
          console.warn('[SSE] Failed to parse event payload:', e.data, err);
        }
      };

      this.eventSource.onerror = (err) => {
        if (this.isManuallyClosed) return;
        this.cleanupEventSource();
        this.onError(err);
        this.scheduleReconnect();
      };
    } catch (err) {
      this.cleanupEventSource();
      this.onError(err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect(immediate = false) {
    if (this.isManuallyClosed) return;

    this.setStatus('RECONNECTING');
    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.setStatus('OFFLINE');
      return;
    }

    if (immediate) {
      this.connect();
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseDelayMs * Math.pow(1.5, this.reconnectAttempts - 1) + Math.random() * 500,
      this.maxDelayMs
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  cleanupEventSource() {
    this.stopHeartbeatWatchdog();
    if (this.eventSource) {
      try {
        this.eventSource.onopen = null;
        this.eventSource.onmessage = null;
        this.eventSource.onerror = null;
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
  }

  clearReplayCache() {
    this.lastEventId = null;
  }

  close() {
    this.isManuallyClosed = true;
    this.lastEventId = null;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupEventSource();
    this.setStatus('OFFLINE');
  }

  reconnect() {
    this.reconnectAttempts = 0;
    this.connect();
  }
}

export const createEventStreamClient = (options) => {
  return new EventStreamClient(options);
};
