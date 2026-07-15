import { api } from '@/admin/lib/api';

export async function fetchShippingZones(): Promise<any> {
  const { data } = await api.get('/admin/shipping/zones');
  return data.data; // array
}

export async function fetchShippingRates(): Promise<any> {
  const { data } = await api.get('/admin/shipping/rates');
  return data.data; // array
}

export interface RatePayload {
  zone_id: string;
  name: string;
  rate_type: string;
  base_price: number;
  min_order_value: number;
  max_order_value: number | string | null;
}

export async function createShippingRate(payload: RatePayload) {
  return api.post('/admin/shipping/rates', payload);
}

export async function updateShippingRate(id: string, payload: RatePayload) {
  return api.put(`/admin/shipping/rates/${id}`, payload);
}

export async function deleteShippingRate(id: string) {
  return api.delete(`/admin/shipping/rates/${id}`);
}

export interface ZonePayload {
  name: string;
  countries: string[];
  rate_strategy?: any;
}

export async function createShippingZone(payload: ZonePayload) {
  return api.post('/admin/shipping/zones', payload);
}

export async function updateShippingZone(id: string, payload: ZonePayload) {
  return api.put(`/admin/shipping/zones/${id}`, payload);
}

export async function deleteShippingZone(id: string) {
  return api.delete(`/admin/shipping/zones/${id}`);
}
