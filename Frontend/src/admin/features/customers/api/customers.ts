import { api } from '@/admin/lib/api';

export async function fetchUser(id: string): Promise<any> {
  const { data } = await api.get(`/admin/users/${id}`).catch(() => ({ data: { data: null } }));
  return data.data;
}

export async function fetchUserOrders(id: string): Promise<any> {
  const { data } = await api.get('/orders/admin/list', { params: { userId: id } });
  return data.data;
}

export async function fetchUsers(params: { page?: number; limit?: number; search?: string }): Promise<any> {
  const { data } = await api.get('/admin/users', { params });
  return data.data;
}
