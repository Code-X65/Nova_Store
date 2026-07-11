import { useEffect, useRef } from 'react';
import type { Notification } from '@/shared/api/types';

/**
 * useAdminRealtime — subscribes to the backend SSE stream (/api/v1/admin/stream)
 * and invokes `onNotification` for every new in-app admin notification pushed
 * by the Role-Based Routing Engine. Falls back gracefully to polling (handled
 * separately by useNotifications) if the stream is unavailable.
 *
 * The EventSource is a module-level singleton so multiple components can
 * subscribe without opening redundant connections.
 */
type Listener = (n: Notification) => void;

let source: EventSource | null = null;
const listeners = new Set<Listener>();
let connectionAttempts = 0;

function ensureConnection() {
  if (source || typeof EventSource === 'undefined') return;
  // Vite proxies /api → backend, so this is same-origin (cookies sent).
  source = new EventSource('/api/v1/admin/stream');

  source.onmessage = (ev) => {
    try {
      const payload = JSON.parse(ev.data);
      if (payload?.type === 'notification' && payload.notification) {
        const n = payload.notification as Notification;
        listeners.forEach((l) => l(n));
      }
    } catch {
      /* ignore malformed frames */
    }
  };

  source.onerror = () => {
    // The gateway sends heartbeats; an error here usually means the auth
    // session ended or the server is down. Close so it can be retried.
    source?.close();
    source = null;
    connectionAttempts++;
    if (connectionAttempts < 5) {
      setTimeout(ensureConnection, 3000);
    }
  };

  source.onopen = () => {
    connectionAttempts = 0;
  };
}

export function useAdminRealtime(onNotification?: (n: Notification) => void) {
  const cb = useRef(onNotification);
  cb.current = onNotification;

  useEffect(() => {
    ensureConnection();
    const listener: Listener = (n) => cb.current?.(n);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && source) {
        source.close();
        source = null;
      }
    };
  }, []);
}

export default useAdminRealtime;
