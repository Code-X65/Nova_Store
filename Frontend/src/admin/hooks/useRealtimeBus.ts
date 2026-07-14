import { useEffect, useRef, useCallback } from 'react';

type EventHandler = (event: Record<string, unknown>) => void;

class RealtimeBus {
  private source: EventSource | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private retry = 1000;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  subscribe(type: string, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    if (!this.source) {
      this.connect();
    }

    return () => {
      this.handlers.get(type)?.delete(handler);
      if (this.handlers.size === 0 || [...this.handlers.values()].every(s => s.size === 0)) {
        this.disconnect();
      }
    };
  }

  private connect() {
    if (this.closed || this.source) return;
    this.source = new EventSource('/api/v1/admin/stream', { withCredentials: true });

    this.source.onmessage = (ev) => {
      const raw = ev.data?.trim();
      if (!raw || raw.startsWith(':')) return;
      try {
        const payload = JSON.parse(raw);
        const type = payload?.type;
        if (type && this.handlers.has(type)) {
          this.handlers.get(type)!.forEach(h => {
            try { h(payload); } catch { /* ignore handler errors */ }
          });
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    this.source.onerror = () => {
      this.source?.close();
      this.source = null;
      if (this.closed) return;
      this.timer = setTimeout(() => this.connect(), this.retry);
      this.retry = Math.min(this.retry * 2, 15000);
    };

    this.source.onopen = () => {
      this.retry = 1000;
    };
  }

  private disconnect() {
    if (this.timer) clearTimeout(this.timer);
    this.source?.close();
    this.source = null;
  }

  destroy() {
    this.closed = true;
    this.disconnect();
    this.handlers.clear();
  }
}

const bus = new RealtimeBus();

export function useRealtimeBus(type: string, handler: EventHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped: EventHandler = (event) => {
      try { handlerRef.current(event); } catch { /* ignore */ }
    };
    const dispose = bus.subscribe(type, wrapped);
    return dispose;
  }, [type]);
}

export function useRealtimeBusAny(handler: (event: Record<string, unknown>) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped: EventHandler = (event) => {
      try { handlerRef.current(event); } catch { /* ignore */ }
    };
    const unsubs: (() => void)[] = [];
    for (const [type, handlers] of bus['handlers'].entries()) {
      if (!handlers.has(wrapped)) {
        unsubs.push(bus.subscribe(type, wrapped));
      }
    }
    // Also subscribe to any future types
    const originalSubscribe = bus.subscribe.bind(bus);
    const unsub = originalSubscribe('*', wrapped);
    return () => {
      unsub();
      unsubs.forEach(u => u());
    };
  }, []);
}

export { bus as realtimeBus };
