import { api } from '@/admin/lib/api';

export interface Guarantor {
  id: string;
  rider_id: string;
  full_name: string;
  relationship: string;
  phone: string;
  address: string;
  id_type: string;
  id_number: string;
  created_at: string;
  updated_at: string;
}

export interface Rider {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  address_jsonb?: Record<string, any>;
  id_type?: string;
  id_number?: string;
  vehicle_type?: string;
  vehicle_registration?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  photo_frontal?: string;
  photo_left_profile?: string;
  photo_right_profile?: string;
  phone_secondary?: string;
  id_doc_url?: string;
  vehicle_doc_url?: string;
  country?: string;
  state?: string;
  city?: string;
  street_address?: string;
  status: 'pending_approval' | 'live' | 'suspended';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  guarantors?: Guarantor[];
}

export interface PaginatedRiders {
  riders: Rider[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchRiders(params: {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
  status?: string;
}): Promise<PaginatedRiders> {
  const { data } = await api.get('/admin/riders', { params });
  return data;
}

export async function fetchActiveRiders(params: {
  search?: string;
}): Promise<{ success: boolean; data: Rider[] }> {
  const { data } = await api.get('/admin/riders/active', { params });
  return data;
}

export async function fetchPendingRiders(params: {
  search?: string;
}): Promise<{ success: boolean; data: Rider[] }> {
  const { data } = await api.get('/admin/riders/pending', { params });
  return data;
}

export async function fetchRider(id: string): Promise<{ success: boolean; data: Rider }> {
  const { data } = await api.get(`/admin/riders/${id}`);
  return data;
}

export async function createRider(payload: Partial<Rider>): Promise<{ success: boolean; data: Rider; message: string }> {
  const { data } = await api.post('/admin/riders', payload);
  return data;
}

export async function updateRider(id: string, payload: Partial<Rider>): Promise<{ success: boolean; data: Rider; message: string }> {
  const { data } = await api.patch(`/admin/riders/${id}`, payload);
  return data;
}

export async function deleteRider(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete(`/admin/riders/${id}`);
  return data;
}

export async function approveRider(id: string): Promise<{ success: boolean; data: Rider; message: string }> {
  const { data } = await api.post(`/admin/riders/${id}/approve`);
  return data;
}

export async function rejectRider(id: string, rejection_reason?: string): Promise<{ success: boolean; data: Rider; message: string }> {
  const { data } = await api.post(`/admin/riders/${id}/reject`, { rejection_reason });
  return data;
}

export async function suspendRider(id: string): Promise<{ success: boolean; data: Rider; message: string }> {
  const { data } = await api.post(`/admin/riders/${id}/suspend`);
  return data;
}

export async function reactivateRider(id: string): Promise<{ success: boolean; data: Rider; message: string }> {
  const { data } = await api.post(`/admin/riders/${id}/reactivate`);
  return data;
}

export async function listGuarantors(riderId: string): Promise<{ success: boolean; data: Guarantor[] }> {
  const { data } = await api.get(`/admin/riders/${riderId}/guarantors`);
  return data;
}

export async function createGuarantor(riderId: string, payload: Partial<Guarantor>): Promise<{ success: boolean; data: Guarantor; message: string }> {
  const { data } = await api.post(`/admin/riders/${riderId}/guarantors`, payload);
  return data;
}

export async function updateGuarantor(riderId: string, guarantorId: string, payload: Partial<Guarantor>): Promise<{ success: boolean; data: Guarantor; message: string }> {
  const { data } = await api.patch(`/admin/riders/${riderId}/guarantors/${guarantorId}`, payload);
  return data;
}

export async function deleteGuarantor(riderId: string, guarantorId: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete(`/admin/riders/${riderId}/guarantors/${guarantorId}`);
  return data;
}
