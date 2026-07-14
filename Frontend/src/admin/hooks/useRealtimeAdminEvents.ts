import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useRealtimeAdminEvents as useSharedRealtime } from '@/admin/hooks/useSharedRealtime';
import type { AdminRealtimeEvent } from '@/admin/lib/realtime';
import { useAdminSession } from '@/admin/hooks/useAdminSession';

export function useRealtimeAdminEvents() {
  const qc = useQueryClient();
  const { session, logout } = useAdminSession();
  const meId = session?.id;

  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const qcRef = useRef(qc);
  qcRef.current = qc;

  const meIdRef = useRef(meId);
  meIdRef.current = meId;

  useSharedRealtime((event: AdminRealtimeEvent) => {
    const currentMeId = meIdRef.current;
    if (!currentMeId) return;

    const currentQc = qcRef.current;
    const isSelf =
      event.userId === currentMeId ||
      event.targetUserId === currentMeId;

    switch (event.type) {
      case 'admin.list.changed':
        currentQc.invalidateQueries({ queryKey: ['admin-staff'] });
        currentQc.invalidateQueries({ queryKey: ['admin-access'] });
        break;

      case 'permissions.updated':
      case 'roles.updated':
        if (isSelf) {
          currentQc.invalidateQueries({ queryKey: ['admin-permissions'] });
          currentQc.invalidateQueries({ queryKey: ['my-permissions'] });
          currentQc.invalidateQueries({ queryKey: ['admin-session'] });
        }
        currentQc.invalidateQueries({ queryKey: ['admin-staff'] });
        currentQc.invalidateQueries({ queryKey: ['admin-access'] });
        break;

      case 'inventory.low_stock':
      case 'inventory.out_of_stock':
      case 'inventory.discrepancy':
      case 'order.picked_out_of_stock':
        currentQc.invalidateQueries({ queryKey: ['inventory'] });
        currentQc.invalidateQueries({ queryKey: ['analytics', 'inventory-stats'] });
        break;

      case 'account.locked':
        if (isSelf) {
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
    qcRef.current.invalidateQueries({ queryKey: ['admin-permissions'] });
    qcRef.current.invalidateQueries({ queryKey: ['my-permissions'] });
  });

  return null;
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

export default useRealtimeAdminEvents;
