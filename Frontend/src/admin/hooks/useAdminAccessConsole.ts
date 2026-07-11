import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';


// ─── List (reuses the staff directory, which now includes lock state) ──────────
export function useAdminAccessList(page = 1, search = '') {
  return useQuery({
    queryKey: ['admin-staff', page, search],
    queryFn: async () => {
      const { data } = await api.get('/admin', { params: { page, limit: 50, search } });
      return data.data;
    }
  });
}


// ─── Mutations ─────────────────────────────────────────────────────────────────
export function useLockAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/access/${id}/lock`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      qc.invalidateQueries({ queryKey: ['admin-access'] });
    }
  });
}

export function useUnlockAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/access/${id}/unlock`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      qc.invalidateQueries({ queryKey: ['admin-access'] });
    }
  });
}

export function useRemoveAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.delete(`/admin/access/${id}/remove`, { data: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      qc.invalidateQueries({ queryKey: ['admin-access'] });
    }
  });
}

