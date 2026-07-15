import { api } from '@/admin/lib/api';

export interface AlertRule {
  id?: string;
  scope: 'product' | 'variant' | 'warehouse' | 'global';
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string | null;
  threshold: number;
  channels: string[];
  recipient_role: string | null;
  is_active: boolean;
}

export async function fetchAlertRules(): Promise<AlertRule[]> {
  const { data } = await api.get('/admin/stock-alerts');
  return data.data.rules;
}

export async function fetchWarehousesMinimal(): Promise<{ id: string; name: string; code: string }[]> {
  const { data } = await api.get('/admin/warehouses');
  return data.data.warehouses;
}

export async function saveAlertRule(body: any) {
  if (body.id) return api.put(`/admin/stock-alerts/${body.id}`, body);
  return api.post('/admin/stock-alerts', body);
}

export async function deleteAlertRule(id: string) {
  return api.delete(`/admin/stock-alerts/${id}`);
}
