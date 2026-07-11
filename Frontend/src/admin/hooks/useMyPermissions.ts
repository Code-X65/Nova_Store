import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import type { AdminPermissions } from '@/shared/api';

const EMPTY: AdminPermissions = { roles: [], permissions: [] };

/**
 * Fetches and caches the current admin's roles + permissions.
 *
 * Freshness strategy (defence-in-depth against stale grants):
 *  - Primary: SSE `permissions.updated` events invalidate ['admin-permissions']
 *    immediately (see useRealtimeAdminEvents).
 *  - Fallback: a short staleTime + refetch on window focus/reconnect so a
 *    missed SSE frame can never leave the UI showing stale permissions for
 *    long. Server-side enforcement is always live regardless of this cache.
 */
export function useMyPermissions(): AdminPermissions & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const res = await api.get<{ data: AdminPermissions }>('/admin/my-permissions');
      return res.data.data;
    },
    staleTime: 60 * 1000,          // 1 min — SSE is primary; this bounds staleness
    refetchOnWindowFocus: true,    // recover from missed SSE frames on tab refocus
    refetchOnReconnect: true,      // recover after network/SSE reconnect
    retry: false,
  });

  return { ...(data ?? EMPTY), isLoading };
}