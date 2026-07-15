import { api } from '@/admin/lib/api';

export async function fetchSessions(): Promise<any> {
  const { data } = await api.get('/admin/sessions');
  return data.data;
}

export async function revokeSession(sessionId: string) {
  return api.delete(`/admin/sessions/${sessionId}`);
}

export async function revokeAllSessions() {
  return api.delete('/admin/sessions');
}
