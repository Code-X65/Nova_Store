import { api } from '@/admin/lib/api';

export interface CustomerEvent {
  id: string;
  customer_id: string;
  event_type: string;
  product_id?: string;
  category_id?: string;
  session_id?: string;
  referrer?: string;
  device_type?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  customer?: { first_name: string; last_name: string; email: string };
  product?: { name: string };
  category?: { name: string };
}

export interface HeatmapEvent {
  event_type: string;
  created_at: string;
  customer: string;
}

export async function fetchCustomerEvents(params: { page?: number; limit?: number; customer_id?: string; event_type?: string; fromDate?: string; toDate?: string } = {}) {
  const { data } = await api.get('/admin/crm/events', { params });
  return data;
}

export async function fetchProductHeatmap(productId: string, from: string, to: string) {
  const { data } = await api.get(`/admin/crm/events/product/${productId}/heatmap`, { params: { from, to } });
  return data.data as HeatmapEvent[];
}

export async function fetchTopViewedProducts(from: string, to: string, limit = 10) {
  const { data } = await api.get('/admin/crm/events/top-products', { params: { from, to, limit } });
  return data.data as { product_id: string; views: number; name?: string; image?: string }[];
}
