import { api } from '@/admin/lib/api';

export async function fetchDailySummary(): Promise<any> {
  const { data } = await api.get('/admin/sales/daily-summary');
  return data.data; // { today: {}, yesterday: {} }
}

export async function fetchOrderTracking(params: { page: number; limit: number }): Promise<any> {
  // Use the generic orders list since it's the same controller method
  const { data } = await api.get('/admin/sales/order-tracking', { params }).catch(() => {
    // Fallback if sales/order-tracking isn't perfectly mapped, though it should be
    return api.get('/orders/admin/list', { params });
  });
  return data.data; // { orders }
}

export async function fetchRevenueAnalytics(params: { from: string; to: string; groupBy: string }): Promise<any> {
  const { data } = await api.get('/admin/analytics/revenue', { params });
  return data.data; // { data: [{period, revenue, orders...}], totals: {} }
}

export async function fetchRevenueSummary(params: { from: string; to: string }): Promise<any> {
  const { data } = await api.get('/admin/analytics/revenue/summary', { params });
  return data.data; // { totalRevenue, totalOrders, averageOrderValue }
}

export async function exportRevenueCsv(params: { from: string; to: string }): Promise<Blob> {
  const response = await api.get('/admin/analytics/export/revenue', {
    params,
    responseType: 'blob'
  });
  return response.data;
}

export async function fetchTopProducts(params: { period: string }): Promise<any> {
  const { data } = await api.get('/admin/sales/top-products', { params });
  return data.data; // { products: [] }
}
