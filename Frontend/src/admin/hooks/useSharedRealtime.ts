import { useRef, useEffect } from 'react';
import type { Notification } from '@/shared/api/types';
import type { AdminRealtimeEvent } from '@/admin/lib/realtime';

type NotificationHandler = (n: Notification) => void;
type EventHandler = (event: AdminRealtimeEvent) => void;

let source: EventSource | null = null;
const notificationListeners = new Set<NotificationHandler>();
const eventListeners = new Set<EventHandler>();
let connectionAttempts = 0;

function ensureConnection() {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/v1/admin/stream');

  source.onmessage = (ev) => {
    const raw = ev.data?.trim();
    if (!raw || raw.startsWith(':')) return;
    try {
      const payload = JSON.parse(raw);
      if (payload?.type === 'notification' && payload.notification) {
        const n = payload.notification as Notification;
        notificationListeners.forEach(l => l(n));
      } else {
        const event = payload as AdminRealtimeEvent;
        eventListeners.forEach(l => l(event));
      }
    } catch {
      /* ignore malformed frames */
    }
  };

  source.onerror = () => {
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
    const listener: NotificationHandler = (n) => cb.current?.(n);
    notificationListeners.add(listener);
    return () => {
      notificationListeners.delete(listener);
      if (notificationListeners.size === 0 && eventListeners.size === 0 && source) {
        source.close();
        source = null;
      }
    };
  }, []);
}

export function useRealtimeAdminEvents(onEvent?: (event: AdminRealtimeEvent) => void, onOpen?: () => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  const openCb = useRef(onOpen);
  openCb.current = onOpen;

  useEffect(() => {
    ensureConnection();
    const listener: EventHandler = (e) => cb.current?.(e);
    eventListeners.add(listener);
    openCb.current?.();
    return () => {
      eventListeners.delete(listener);
      if (notificationListeners.size === 0 && eventListeners.size === 0 && source) {
        source.close();
        source = null;
      }
    };
  }, []);
}

export function closeRealtimeConnection() {
  if (source) {
    source.close();
    source = null;
  }
}
