import { api } from '@/admin/lib/api';

export interface LocationPing {
  id: string;
  rider_id: string;
  order_id: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy_m: number | null;
  captured_at: string;
}

export async function pingLocation(payload: { riderId: string; orderId?: string; lat: number; lng: number; heading?: number; speed?: number; accuracyM?: number }) {
  const { riderId, ...rest } = payload;
  const { data } = await api.post(`/admin/rider-tracking/${riderId}/ping`, rest);
  return data.data.ping as LocationPing;
}

export async function fetchLatestLocation(riderId: string) {
  const { data } = await api.get(`/admin/rider-tracking/${riderId}/location`);
  return data.data.location as LocationPing | null;
}

export async function fetchOrderRoute(orderId: string) {
  const { data } = await api.get(`/admin/rider-tracking/orders/${orderId}/track`);
  return data.pings as LocationPing[];
}

export async function recordPod(dispatchId: string, payload: { podPhotoUrl?: string; podSignatureUrl?: string; lat?: number; lng?: number; geofenceEtaAt?: string }) {
  const { data } = await api.post(`/admin/rider-tracking/dispatches/${dispatchId}/pod`, payload);
  return data.data.dispatch;
}
