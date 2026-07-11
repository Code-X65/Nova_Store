import { useState, useCallback } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminRealtime } from '@/admin/hooks/useAdminRealtime';
import type { Notification, NotificationSeverity } from '@/shared/api/types';

interface ToastItem extends Notification {
  toastId: number;
}

const SEVERITY_STYLES: Record<NotificationSeverity, string> = {
  critical: 'border-danger/40 bg-danger/10',
  warning: 'border-nova-400/40 bg-nova-400/10',
  info: 'border-white/10 bg-surface-2/80',
};

const SEVERITY_ICON: Record<NotificationSeverity, typeof InformationCircleIcon> = {
  critical: ExclamationTriangleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

/**
 * Renders instant in-app popups for realtime admin notifications pushed over
 * the SSE stream. Each toast auto-dismisses after 6s and also invalidates the
 * notification query so the bell badge updates immediately.
 */
export function NotificationToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const qc = useQueryClient();
  const counter = useRefCounter();

  const handleNotification = useCallback(
    (n: Notification) => {
      const severity = (n.severity as NotificationSeverity) || 'info';
      const toastId = counter();
      setToasts((prev) => [...prev.slice(-3), { ...n, toastId }]);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
      }, 6000);
    },
    [counter, qc]
  );

  useAdminRealtime(handleNotification);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-80">
      {toasts.map((t) => {
        const severity = (t.severity as NotificationSeverity) || 'info';
        const Icon = SEVERITY_ICON[severity];
        return (
          <div
            key={t.toastId}
            className={`glass-card rounded-xl border p-4 shadow-nova-xl animate-slide-down ${SEVERITY_STYLES[severity]}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                severity === 'critical' ? 'text-danger' : severity === 'warning' ? 'text-nova-400' : 'text-muted-foreground'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{t.message}</p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.toastId !== t.toastId))}
                className="text-muted hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Tiny monotonic id generator (avoids adding a dependency).
function useRefCounter() {
  const ref = useState({ n: 0 })[0];
  return () => {
    ref.n += 1;
    return ref.n;
  };
}

export default NotificationToasts;
