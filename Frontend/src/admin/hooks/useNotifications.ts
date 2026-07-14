import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import type { Notification } from '@/shared/api/types';

export function useNotifications(filter: 'all' | 'unread' | 'catalog' = 'unread') {
  const qc = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data.data.unreadCount || 0;
    },
    refetchInterval: 30000,
  });

  const notifyFilter = filter === 'catalog' ? 'all' : filter;

  const { data: notifications = [], refetch: fetchList } = useQuery({
    queryKey: ['notifications', 'list', notifyFilter],
    queryFn: async () => {
      const { data } = await api.get(`/notifications?isRead=${notifyFilter === 'unread' ? 'false' : 'true'}`);
      return (data.data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        read: n.is_read || n.read || false,
        createdAt: n.created_at || n.createdAt,
        type: n.type,
        severity: n.severity || 'info',
        recipientRole: n.recipient_role || null,
        deepLink: n.data?.deepLink || n.deepLink || null,
        data: n.data || {},
      })) as Notification[];
    },
    enabled: false,
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
