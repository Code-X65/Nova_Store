import { api } from '@/admin/lib/api';

export async function fetchRoles(): Promise<any> {
  const { data } = await api.get('/roles');
  return data.data; // array
}

export interface RolePayload {
  name: string;
  display_name: string;
  description: string;
  color_code: string;
}

export async function createRole(payload: RolePayload) {
  return api.post('/roles', payload);
}

export async function updateRole(id: string, payload: RolePayload) {
  return api.patch(`/roles/${id}`, payload);
}

export async function deleteRole(id: string) {
  return api.delete(`/roles/${id}`);
}
