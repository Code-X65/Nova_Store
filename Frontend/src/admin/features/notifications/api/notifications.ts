import { api } from '@/admin/lib/api';

export async function fetchNotificationsInbox(params: { isRead: boolean; page: number; limit: number }): Promise<any> {
  const { data } = await api.get(`/notifications?isRead=${params.isRead}&page=${params.page}&limit=${params.limit}`);
  return data.data;
}

export async function markNotificationRead(id: string) {
  return api.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  return api.post('/notifications/mark-all-read');
}

export async function dismissNotification(id: string) {
  return api.delete(`/notifications/${id}`);
}

export async function sendBroadcast(payload: { title: string; message: string; target_type: string }) {
  return api.post('/admin/notifications/broadcast', payload);
}

export async function fetchNotificationTemplates(): Promise<any> {
  const { data } = await api.get('/admin/notifications/templates');
  return data.data;
}

export interface TemplatePayload {
  name: string;
  subject: string;
  body: string;
}

export async function createNotificationTemplate(payload: TemplatePayload) {
  return api.post('/admin/notifications/templates', payload);
}

export async function updateNotificationTemplate(id: string, payload: TemplatePayload) {
  return api.patch(`/admin/notifications/templates/${id}`, payload);
}

export async function deleteNotificationTemplate(id: string) {
  return api.delete(`/admin/notifications/templates/${id}`);
}
