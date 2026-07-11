import { api } from '@/admin/lib/api';

const BASE_URL = import.meta.env.VITE_ADMIN_API_URL || '/api/v1';
const STREAM_URL = `${BASE_URL}/admin/stream`;

export interface AdminRealtimeEvent {
  type: string;
  userId?: string;
  targetUserId?: string;
  actor?: string;
  at?: number;
  [key: string]: unknown;
}

/**
 * Open a Server-Sent Events stream for real-time access-management updates.
 *
 * - Uses the session cookie (`withCredentials: true`) — no custom headers, so
 *   no CSRF token is required (the route is GET-only).
 * - Automatically reconnects with backoff and ignores heartbeat comments.
 *
 * @param onEvent  handler invoked for each parsed event
 * @param onOpen   optional handler invoked on each (re)connection — useful to
 *                 re-sync cached state that may have changed while disconnected
 * @returns        a close/dispose function
 */
export function openAdminEventStream(
  onEvent: (event: AdminRealtimeEvent) => void,
  onOpen?: () => void,
): () => void {
  let es: EventSource | null = null;
  let retry = 1000;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    es = new EventSource(STREAM_URL, { withCredentials: true });

    es.onmessage = (msg) => {
      const raw = msg.data?.trim();
      if (!raw || raw.startsWith(':')) return; // heartbeat / comment
      try {
        onEvent(JSON.parse(raw) as AdminRealtimeEvent);
      } catch {
        /* ignore malformed */
      }
    };

    es.onerror = () => {
      es?.close();
      es = null;
      if (closed) return;
      timer = setTimeout(connect, retry);
      retry = Math.min(retry * 2, 15000);
    };

    es.onopen = () => {
      retry = 1000;
      onOpen?.();
    };
  };

  connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    es?.close();
  };
}
