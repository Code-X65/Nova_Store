import { useState, useRef, useEffect } from 'react';
import { BellIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '@/admin/hooks/useNotifications';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { unreadCount, notifications, fetchList, markRead, markAllRead, dismiss } = useNotifications();

  // Fetch list when panel opens
  useEffect(() => {
    if (open) fetchList();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        className="relative btn-ghost p-3 rounded-2xl shadow-neu-outer hover:shadow-neu-outer-sm active:shadow-neu-inner text-neu-text hover:text-neu-accent transition-all"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-neu-accent text-white text-[9px] font-bold
                           rounded-full flex items-center justify-center shadow-neu-outer-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 glass-card shadow-nova-xl z-50 animate-slide-down overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs text-nova-400 hover:text-nova-300 flex items-center gap-1"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                No notifications
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={clsx(
                    'flex gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2/50 transition-colors',
                    !n.read && 'bg-nova-600/5'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    {!n.read && (
                      <span className="inline-block w-1.5 h-1.5 bg-nova-500 rounded-full mr-1.5 align-middle" />
                    )}
                    <p className="text-sm text-white font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-muted mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                    className="p-1 text-muted hover:text-danger transition-colors flex-shrink-0 self-start mt-0.5"
                    aria-label="Dismiss"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}