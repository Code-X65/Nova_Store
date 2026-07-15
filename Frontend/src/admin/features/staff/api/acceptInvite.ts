import { api } from '@/admin/lib/api';

export interface InviteDetails {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  storeName: string;
  expiresAt: string;
  status: string;
}

export async function fetchInviteDetails(token: string): Promise<InviteDetails> {
  const { data } = await api.get<{ data: InviteDetails }>(`/accept-invite/${token}`);
  return data.data;
}

export async function acceptInvite({ token, firstName, lastName, password }: { token: string; firstName: string; lastName: string; password: string }) {
  const { data } = await api.post(`/accept-invite/${token}`, { firstName, lastName, password });
  return data;
}
