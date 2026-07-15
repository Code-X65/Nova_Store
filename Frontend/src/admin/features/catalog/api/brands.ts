import { api } from '@/admin/lib/api';

export async function fetchBrands(params: { activeOnly?: boolean; featuredOnly?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.activeOnly) search.set('activeOnly', 'true');
  if (params.featuredOnly) search.set('featuredOnly', 'true');
  const { data } = await api.get(`/brands?${search.toString()}`);
  return Array.isArray(data.data) ? data.data : (data.data?.brands || []);
}

export async function fetchBrandById(id: string) {
  const { data } = await api.get(`/brands/${id}`);
  return data.data;
}

export async function createBrand(payload: any) {
  return api.post('/brands', payload);
}

export async function updateBrand(id: string, payload: any) {
  return api.patch(`/brands/${id}`, payload);
}

export async function deleteBrand(id: string) {
  return api.delete(`/brands/${id}`);
}
