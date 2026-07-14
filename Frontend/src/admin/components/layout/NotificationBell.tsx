import { useState, useRef, useEffect, useMemo } from 'react';
import { BellIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@/admin/hooks/useNotifications';
import { useAdminRealtime } from '@/admin/hooks/useSharedRealtime';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'catalog'>('unread');
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { unreadCount, notifications, fetchList, markRead, markAllRead, dismiss } = useNotifications(filter);

  const catalogNotifications = useMemo(() => {
    if (filter !== 'catalog') return notifications;
    return notifications.filter(n => {
      const t = (n as any).type || '';
      return t.startsWith('catalog.') || t.startsWith('product.') || t.startsWith('category.') || t.startsWith('brand.') || t.startsWith('attribute.');
    });
  }, [notifications, filter]);

  // Refresh list when panel opens
  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  // Instant update: bump the unread badge + refresh list on SSE push
  useAdminRealtime((n) => {
    qc.setQueryData(['notifications', 'unread-count'], (prev: number = 0) => prev + 1);
    if (open) fetchList();
  });

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

  const handleRowClick = (n: any) => {
    markRead(n.id);
    if (n.deepLink) {
      navigate(n.deepLink);
      setOpen(false);
    }
  };

  const visibleNotifications = filter === 'catalog' ? catalogNotifications : notifications;

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
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-[#111111] p-0.5">
                {(['all', 'unread', 'catalog'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      filter === f ? 'bg-nova-500/20 text-nova-400' : 'text-muted-foreground hover:text-white'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Catalog'}
                  </button>
                ))}
              </div>
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
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {visibleNotifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                No notifications
              </p>
            ) : (
              visibleNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleRowClick(n)}
                  className={clsx(
                    'flex gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2/50 transition-colors',
                    !n.read && 'bg-nova-600/5'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 border-l-2 ${
                          n.severity === 'critical' ? 'border-l-danger bg-danger/20'
                          : n.severity === 'warning' ? 'border-l-nova-400 bg-nova-400/20'
                          : 'border-l-muted bg-muted/20'
                        }`}
                        title={n.severity}
                      />
                      <p className="text-sm text-white font-medium truncate">{n.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {n.recipientRole && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-nova-600/20 text-nova-300">
                          {n.recipientRole}
                        </span>
                      )}
                      <p className="text-[11px] text-muted">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
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
