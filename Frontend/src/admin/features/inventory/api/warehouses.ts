import { api } from '@/admin/lib/api';

export interface Warehouse { id: string; code: string; name: string; location: string | null; is_active: boolean; }
export interface Level {
  id: string; product_id: string; variant_id: string | null; warehouse_id: string;
  quantity: number; reserved: number; low_stock_threshold: number;
  products?: { sku: string; name: string } | null;
  product_variants?: { sku: string } | null;
  warehouses?: { name: string; code: string } | null;
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const { data } = await api.get('/admin/warehouses');
  return data.data.warehouses;
}

export async function fetchWarehouseStock(warehouseId: string): Promise<Level[]> {
  const { data } = await api.get('/admin/warehouses/stock', { params: { warehouseId } });
  return data.data.levels;
}

export async function createWarehouse(payload: { code: string; name: string; location: string | null }) {
  const { data } = await api.post('/admin/warehouses', payload);
  return data.data.warehouse;
}

export async function transferStock(payload: { productId: string | null; fromWarehouseId: string; toWarehouseId: string; quantity: number }) {
  const { data } = await api.post('/admin/warehouses/transfer', payload);
  return data.data;
}
