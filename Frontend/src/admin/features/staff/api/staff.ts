import { api } from '@/admin/lib/api';

export async function fetchStaff(params: { page: number; limit: number; search: string }): Promise<any> {
  const { data } = await api.get('/admin', { params });
  return data.data; // { admins, total }
}

export async function revokeStaffAccess(id: string) {
  return api.delete(`/admin/${id}`);
}

export async function fetchStaffAccess(staffId: string): Promise<any> {
  const { data } = await api.get(`/admin/${staffId}/permissions`);
  return data.data;
}

export async function updateStaffRoles(staffId: string, roleIds: string[]) {
  return api.patch(`/admin/${staffId}/roles`, { roleIds });
}

export async function fetchMyPermissions(): Promise<any> {
  const { data } = await api.get('/admin/my-permissions');
  return data.data; // { roles, permissions, rolePermissions, overrides }
}
