import { api } from '@/admin/lib/api';

export interface IpAllowlistEntry {
  id: string;
  ip_cidr: string;
  label: string | null;
  role_scope: string[];
  is_active: boolean;
  created_at: string;
}

export async function fetchIpAllowlist(): Promise<IpAllowlistEntry[]> {
  const { data } = await api.get<{ success: boolean; data: IpAllowlistEntry[] }>('/admin/ip-allowlist');
  return data.data;
}

export interface IpAllowlistPayload {
  ip_cidr: string;
  label: string | null;
  role_scope: string[];
  is_active: boolean;
}

export async function createIpAllowlistEntry(payload: IpAllowlistPayload) {
  return api.post('/admin/ip-allowlist', payload);
}

export async function updateIpAllowlistEntry(id: string, payload: IpAllowlistPayload) {
  return api.put(`/admin/ip-allowlist/${id}`, payload);
}

export async function deleteIpAllowlistEntry(id: string) {
  return api.delete(`/admin/ip-allowlist/${id}`);
}
