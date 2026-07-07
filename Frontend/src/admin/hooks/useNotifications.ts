import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: string;
}

export function useNotifications() {
  const qc = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data.data.count || 0;
    },
    refetchInterval: 30000, // Poll every 30s
  });

  const { data: notifications = [], refetch: fetchList } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const { data } = await api.get('/notifications');
      // Normalize casing since backend might return snake_case
      return (data.data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        read: n.is_read || n.read,
        createdAt: n.created_at || n.createdAt,
        type: n.type,
      })) as Notification[];
    },
    enabled: false, // Only fetch when opened
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    unreadCount,
    notifications,
    fetchList,
    markRead: (id: string) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
    dismiss: (id: string) => dismissMutation.mutate(id),
  };
}