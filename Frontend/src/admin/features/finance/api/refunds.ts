import { api } from '@/admin/lib/api';

export interface Refund {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  reason: string | null;
  method: string;
  status: string;
  gateway_reference: string | null;
  created_at: string;
  order?: { order_number: string; customer_email: string | null };
}

export async function fetchRefunds(params: { page?: number; limit?: number; status?: string; orderId?: string } = {}) {
  const { data } = await api.get('/admin/refunds', { params });
  return data;
}

export async function fetchOrderRefunds(orderId: string) {
  const { data } = await api.get(`/admin/refunds/orders/${orderId}`);
  return data.data.refunds as Refund[];
}

export async function createRefund(payload: { orderId: string; amount: number; reason?: string; method?: string }) {
  const { data } = await api.post('/admin/refunds', payload);
  return data.data.refund as Refund;
}

export async function processRefund(id: string) {
  const { data } = await api.post(`/admin/refunds/${id}/process`);
  return data.data.refund as Refund;
}

export async function cancelRefund(id: string) {
  const { data } = await api.post(`/admin/refunds/${id}/cancel`);
  return data.data.refund as Refund;
}
