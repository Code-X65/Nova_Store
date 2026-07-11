import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { openAdminEventStream, type AdminRealtimeEvent } from '@/admin/lib/realtime';
import { useAdminSession } from '@/admin/hooks/useAdminSession';

/**
 * Single source of real-time state sync for the admin SPA.
 *
 * Mounted once (AppShell). Translates server events into TanStack Query
 * cache invalidations and, for the current admin, into immediate session
 * invalidation — guaranteeing no stale permission/lock state across devices.
 */
export function useRealtimeAdminEvents() {
  const qc = useQueryClient();
  const { session, logout } = useAdminSession();
  const meId = session?.id;

  // Keep logout in a ref so the subscription isn't torn down/recreated on
  // every provider render (logout identity changes each render).
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    if (!meId) return;

    const dispose = openAdminEventStream((event: AdminRealtimeEvent) => {
      const isSelf =
        event.userId === meId ||
        event.targetUserId === meId;

      switch (event.type) {
        // Management dashboard list changed → refetch staff directory.
        case 'admin.list.changed':
          qc.invalidateQueries({ queryKey: ['admin-staff'] });
          qc.invalidateQueries({ queryKey: ['admin-access'] });
          break;

        // Own permissions/roles changed → refetch perms so RequirePermission recomputes.
        case 'permissions.updated':
        case 'roles.updated':
          if (isSelf) {
            qc.invalidateQueries({ queryKey: ['admin-permissions'] });
            qc.invalidateQueries({ queryKey: ['my-permissions'] });
            qc.invalidateQueries({ queryKey: ['admin-session'] });
          }
          qc.invalidateQueries({ queryKey: ['admin-staff'] });
          qc.invalidateQueries({ queryKey: ['admin-access'] });
          break;

        // Own account locked / removed / session revoked → force logout everywhere.
        case 'account.locked':
          if (isSelf) {
            // Do not force logout directly; show the override popup.
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('account-locked'));
            }
          }
          break;
        case 'account.removed':
          if (isSelf) {
            toast.error('Your administrator access was permanently removed.');
            forceLogout(logoutRef.current);
          }
          break;
        case 'session.revoked':
          if (isSelf) {
            toast.error('Your session was revoked by a Super Admin.');
            forceLogout(logoutRef.current);
          }
          break;

        default:
          break;
      }
    }, () => {
      // On every (re)connection, re-sync the permission cache so a change that
      // landed while this client was disconnected is never missed.
      qc.invalidateQueries({ queryKey: ['admin-permissions'] });
      qc.invalidateQueries({ queryKey: ['my-permissions'] });
    });

    return dispose;
  }, [meId, qc]);
}

function forceLogout(logout: () => Promise<void>) {
  try {
    const channel = new BroadcastChannel('admin-session-channel');
    channel.postMessage('LOGOUT');
    channel.close();
  } catch {
    /* ignore */
  }
  logout().catch(() => {
    if (typeof window !== 'undefined') window.location.href = '/login';
  });
}
