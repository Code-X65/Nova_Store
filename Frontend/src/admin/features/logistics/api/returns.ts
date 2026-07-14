import { api } from '@/admin/lib/api';

export interface RmaReturn {
  id: string;
  order_id: string;
  rma_number: string;
  status: string;
  reason: string | null;
  condition: string | null;
  return_method: string;
  refund_amount: number;
  currency: string;
  tracking_number: string | null;
  created_at: string;
  labels?: RmaLabel[];
  order?: { order_number: string; customer_email: string | null };
}

export interface RmaLabel {
  id: string;
  carrier: string | null;
  label_url: string | null;
  tracking_number: string | null;
  created_at: string;
}

export async function fetchReturns(params: { page?: number; limit?: number; status?: string; orderId?: string } = {}) {
  const { data } = await api.get('/admin/returns', { params });
  return data;
}

export async function fetchOrderReturns(orderId: string) {
  const { data } = await api.get(`/admin/returns/orders/${orderId}`);
  return data.data.returns as RmaReturn[];
}

export async function createRma(payload: { orderId: string; reason?: string; condition?: string; returnMethod?: string; refundAmount?: number }) {
  const { data } = await api.post('/admin/returns', payload);
  return data.data.rma as RmaReturn;
}

export async function transitionRma(id: string, action: string, payload: { note?: string; condition?: string; qcOutcome?: string; refundAmount?: number } = {}) {
  const { data } = await api.post(`/admin/returns/${id}/transition`, { action, ...payload });
  return data.data.rma as RmaReturn;
}

export async function generateReturnLabel(id: string, payload: { carrier?: string; trackingNumber?: string } = {}) {
  const { data } = await api.post(`/admin/returns/${id}/label`, payload);
  return data.data.label as RmaLabel;
}

export function labelUrl(label: RmaLabel) {
  // label_url is stored root-relative and served by the backend static handler.
  return label.label_url || '';
}
