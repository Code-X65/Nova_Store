import { api } from '@/admin/lib/api';

export interface HeatmapEvent {
  event_type: string;
  created_at: string;
  customer: string;
}

export interface HeatmapSummaryEvent {
  event_type: string;
  product_id: string;
  product_name?: string;
  category_id?: string;
  category_name?: string;
  created_at: string;
  customer: string;
}

export async function fetchProductHeatmap(productId: string, from: string, to: string) {
  const { data } = await api.get(`/admin/analytics/heatmap/product/${productId}`, { params: { from, to } });
  return data.data as HeatmapEvent[];
}

export async function fetchHeatmapSummary(from: string, to: string) {
  const { data } = await api.get('/admin/analytics/heatmap/summary', { params: { from, to } });
  return data.data as HeatmapSummaryEvent[];
}
