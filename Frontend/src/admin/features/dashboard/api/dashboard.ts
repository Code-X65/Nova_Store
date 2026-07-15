import { api } from '@/admin/lib/api';

export async function fetchDashboardAnalytics(params: { from: string; to: string; period: string }): Promise<any> {
  const { data } = await api.get('/admin/analytics/dashboard', { params });
  return data.data;
}

export async function fetchUsersAnalytics(params: { from: string; to: string; groupBy: string }): Promise<any> {
  const { data } = await api.get('/admin/analytics/users', { params });
  return data.data;
}

export async function fetchBestSellers(params: { from: string; to: string; limit: number }): Promise<any> {
  const { data } = await api.get('/admin/analytics/best-sellers', { params });
  return data.data;
}

export async function fetchRecentOrders(params: { limit: number }): Promise<any> {
  const { data } = await api.get('/orders/admin/list', { params });
  return data;
}

export async function fetchInventoryStats(params: { limit: number }): Promise<any> {
  const { data } = await api.get('/admin/dashboard/inventory-stats', { params });
  return data.data; // { lowStockProducts, outOfStockProducts }
}

export async function fetchOrderStats(params: { period: string }): Promise<any> {
  const { data } = await api.get('/admin/dashboard/order-stats', { params });
  return data.data;
}

export async function fetchDispatchQueuePreview(): Promise<any> {
  const { data } = await api.get('/orders/admin/dispatch-queue');
  return data.data; // { orders }
}

export async function fetchRecentOrdersPreview(params: { limit: number }): Promise<any> {
  const { data } = await api.get('/orders/admin/list', { params });
  return data.data; // { orders }
}
