import { api } from '@/admin/lib/api';

export interface Dispute {
  id: string;
  order_id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  resolution: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  created_at: string;
  order?: { order_number: string; customer_email: string | null };
}

export async function fetchDisputes(params: { page?: number; limit?: number; status?: string; priority?: string; breaching?: boolean } = {}) {
  const { data } = await api.get('/admin/disputes', { params });
  return data;
}

export async function createDispute(payload: { orderId: string; subject: string; description?: string; priority?: string }) {
  const { data } = await api.post('/admin/disputes', payload);
  return data.data.dispute as Dispute;
}

export async function assignDispute(id: string, assignedTo: string) {
  const { data } = await api.post(`/admin/disputes/${id}/assign`, { assignedTo });
  return data.data.dispute as Dispute;
}

export async function escalateDispute(id: string) {
  const { data } = await api.post(`/admin/disputes/${id}/escalate`);
  return data.data.dispute as Dispute;
}

export async function resolveDispute(id: string, payload: { resolution?: string; resolutionNotes?: string; status?: string }) {
  const { data } = await api.post(`/admin/disputes/${id}/resolve`, payload);
  return data.data.dispute as Dispute;
}
