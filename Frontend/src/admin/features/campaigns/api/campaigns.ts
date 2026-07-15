import { api } from '@/admin/lib/api';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  scope: 'all_products' | 'category' | 'brand' | 'products';
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

export async function fetchCampaigns(params: { page?: number; limit?: number; isActive?: boolean } = {}) {
  const { data } = await api.get('/admin/campaigns', { params });
  return data.data as { data: Campaign[]; count: number; page: number; limit: number };
}

export async function fetchCampaign(id: string) {
  const { data } = await api.get(`/admin/campaigns/${id}`);
  return data.data.campaign as Campaign;
}

export async function createCampaign(payload: Partial<Campaign> & { product_ids?: string[]; category_ids?: string[]; brand_ids?: string[] }) {
  const { data } = await api.post('/admin/campaigns', payload);
  return data.data.campaign as Campaign;
}

export async function updateCampaign(id: string, payload: Partial<Campaign> & { product_ids?: string[]; category_ids?: string[]; brand_ids?: string[] }) {
  const { data } = await api.patch(`/admin/campaigns/${id}`, payload);
  return data.data.campaign as Campaign;
}

export async function deleteCampaign(id: string) {
  await api.delete(`/admin/campaigns/${id}`);
}
