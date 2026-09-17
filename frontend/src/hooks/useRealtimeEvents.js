import { useRealtime } from '../context/RealtimeContext.jsx';

/**
 * Hook to consume real-time banking Server-Sent Events (SSE).
 *
 * Exposes:
 * - connected: boolean
 * - lastEvent: object | null
 * - connectionStatus: 'CONNECTED' | 'RECONNECTING' | 'OFFLINE'
 * - reconnect: () => void
 */
export const useRealtimeEvents = () => {
  const realtime = useRealtime();
  return {
    connected: realtime.connected,
    lastEvent: realtime.lastEvent,
    connectionStatus: realtime.connectionStatus,
    reconnect: realtime.reconnect,
  };
};

export default useRealtimeEvents;
