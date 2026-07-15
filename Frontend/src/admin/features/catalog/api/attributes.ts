import { api } from '@/admin/lib/api';

export async function fetchCategoryAttributes(categoryId: string) {
  const { data } = await api.get(`/categories/${categoryId}/attributes`);
  return data.data.attributes ?? [];
}

export async function createCategoryAttribute(categoryId: string, payload: any) {
  return api.post(`/categories/${categoryId}/attributes`, payload);
}

export async function updateCategoryAttribute(id: string, payload: any) {
  return api.put(`/attributes/${id}`, payload);
}

export async function deleteCategoryAttribute(id: string) {
  return api.delete(`/attributes/${id}`);
}
