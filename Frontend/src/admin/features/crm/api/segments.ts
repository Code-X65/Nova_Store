import { api } from '@/admin/lib/api';

export interface Segment {
  id: string;
  name: string;
  description?: string;
  rules: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchSegments(params: { page?: number; limit?: number; is_active?: boolean; search?: string } = {}) {
  const { data } = await api.get('/admin/crm/segments', { params });
  return data;
}

export async function createSegment(payload: { name: string; description?: string; rules?: Record<string, unknown>; is_active?: boolean }) {
  const { data } = await api.post('/admin/crm/segments', payload);
  return data.data.segment as Segment;
}

export async function updateSegment(id: string, payload: { name?: string; description?: string; rules?: Record<string, unknown>; is_active?: boolean }) {
  const { data } = await api.put(`/admin/crm/segments/${id}`, payload);
  return data.data.segment as Segment;
}

export async function deleteSegment(id: string) {
  const { data } = await api.delete(`/admin/crm/segments/${id}`);
  return data;
}
