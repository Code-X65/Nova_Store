import { api } from '@/admin/lib/api';

export async function fetchCoupon(id: string): Promise<any> {
  const { data } = await api.get(`/admin/coupons/${id}`);
  return data.data;
}

export async function fetchCoupons(params: { page?: number; limit?: number }): Promise<any> {
  const { data } = await api.get('/admin/coupons', { params });
  return data.data; // { coupons }
}

export interface CouponPayload {
  code: string;
  description: string;
  type: string;
  value: number;
  min_order_amount: number;
  usage_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export async function createCoupon(payload: CouponPayload) {
  return api.post('/admin/coupons', payload);
}

export async function updateCoupon(id: string, payload: CouponPayload) {
  return api.patch(`/admin/coupons/${id}`, payload);
}

export async function deleteCoupon(id: string) {
  return api.delete(`/admin/coupons/${id}`);
}

export async function deactivateCoupon(id: string) {
  return api.post(`/admin/coupons/${id}/deactivate`);
}

export async function activateCoupon(id: string) {
  return api.patch(`/admin/coupons/${id}`, { is_active: true });
}
