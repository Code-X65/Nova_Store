import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import type { AdminPermissions } from '@/shared/api';

const EMPTY: AdminPermissions = { roles: [], permissions: [] };

/**
 * Fetches and caches the current admin's roles + permissions.
 * Refreshed once per session (very long staleTime).
 * Falls back to empty permissions when not logged in.
 */
export function useMyPermissions(): AdminPermissions & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const res = await api.get<{ data: AdminPermissions }>('/admin/my-permissions');
      return res.data.data;
    },
    staleTime: 30 * 60 * 1000, // 30 min Ã¢â‚¬â€ permissions rarely change mid-session
    retry: false,
  });

  return { ...(data ?? EMPTY), isLoading };
}