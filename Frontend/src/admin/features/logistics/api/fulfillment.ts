import { api } from '@/admin/lib/api';

export interface FulfillmentProvider {
  id: string;
  name: string;
  code: string;
  adapter: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export interface FulfillmentShipment {
  id: string;
  order_id: string;
  provider_id: string;
  external_shipment_id: string | null;
  status: string;
  tracking_number: string | null;
  label_url: string | null;
  provider?: { name: string; code: string };
}

export async function fetchProviders() {
  const { data } = await api.get('/admin/fulfillment/providers');
  return data.data.providers as FulfillmentProvider[];
}

export async function createProvider(payload: { name: string; code: string; adapter?: string; isEnabled?: boolean; config?: Record<string, unknown>; webhookSecret?: string }) {
  const { data } = await api.post('/admin/fulfillment/providers', payload);
  return data.data.provider as FulfillmentProvider;
}

export async function updateProvider(id: string, payload: Partial<FulfillmentProvider>) {
  const { data } = await api.patch(`/admin/fulfillment/providers/${id}`, payload);
  return data.data.provider as FulfillmentProvider;
}

export async function createShipment(payload: { orderId: string; providerId: string; payload?: Record<string, unknown> }) {
  const { data } = await api.post('/admin/fulfillment/shipments', payload);
  return data.data.shipment as FulfillmentShipment;
}

export async function fetchShipments(params: { page?: number; limit?: number; orderId?: string; status?: string } = {}) {
  const { data } = await api.get('/admin/fulfillment/shipments', { params });
  return data;
}
