import { api } from '@/admin/lib/api';

export async function fetchInvitations(params: { status: string }): Promise<any> {
  const { data } = await api.get('/admin/invitations', { params });
  return data.data; // { invitations }
}

export async function sendInvitation(email: string, role_id: string) {
  return api.post('/admin/invitations', { email, role_id });
}

export async function revokeInvitation(id: string) {
  return api.delete(`/admin/invitations/${id}`);
}

export async function resendInvitation(id: string) {
  return api.post(`/admin/invitations/${id}/resend`);
}
