import { api } from '@/admin/lib/api';

export async function fetchCategoryTree() {
  const { data } = await api.get('/categories?type=tree');
  return data.data.categories ?? [];
}

export async function fetchCategoryById(id: string) {
  const { data } = await api.get(`/categories/${id}`);
  return data.data.category;
}

export async function createCategory(payload: any) {
  return api.post('/categories', payload);
}

export async function updateCategory(id: string, payload: any) {
  return api.patch(`/categories/${id}`, payload);
}

export async function deleteCategory(id: string, cascade = false) {
  const url = cascade ? `/categories/${id}?cascade=true` : `/categories/${id}`;
  return api.delete(url);
}

export async function reorderCategories(categories: { id: string; sort_order: number }[]) {
  return api.put('/categories/reorder', { categories });
}

export async function bulkCreateCategories(payload: any) {
  return api.post('/categories/bulk', payload);
}
