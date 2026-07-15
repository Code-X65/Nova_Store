import { api } from '@/admin/lib/api';

export async function fetchProductsMinimal(params: { limit: number }): Promise<{ id: string; name: string; sku: string }[]> {
  const { data } = await api.get('/products', { params });
  return data.data.products;
}

export async function fetchLowStockProducts(): Promise<any> {
  const { data } = await api.get('/inventory/low-stock');
  // The controller returns { success: true, data: [...] }
  return data.data;
}

export async function fetchStockLevels(params: { search: string; limit: number; page: number }): Promise<any> {
  const { data } = await api.get('/products', { params });
  return data.data;
}

export async function updateThreshold(id: string, threshold: number) {
  return api.put(`/inventory/${id}/threshold`, { lowStockThreshold: threshold });
}

export async function fetchTransactions(params: { page: number; limit: number; type?: string }): Promise<any> {
  const { data } = await api.get('/inventory/transactions', { params });
  return data.data;
}

export async function fetchProductDetail(id: string): Promise<any> {
  const { data } = await api.get(`/inventory/${id}`);
  return data.data;
}

export interface AdjustStockPayload {
  productId: string;
  quantityChange: number;
  reasonCode: string;
  notes: string;
}

export async function adjustStock(payload: AdjustStockPayload) {
  return api.post('/inventory/adjust', payload);
}
