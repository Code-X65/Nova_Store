import { api } from '@/admin/lib/api';

export async function fetchLocalizationSettings(): Promise<any> {
  const { data } = await api.get('/admin/settings/localization');
  return data.data;
}

export async function fetchSeoSettings(): Promise<any> {
  const { data } = await api.get('/admin/settings/seo');
  return data.data;
}

export async function uploadStoreImage(file: File): Promise<string> {
  const payload = new FormData();
  payload.append('file', file);
  const res = await api.post('/admin/upload', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.data.url;
}

export async function updateStoreImageField(key: string, url: string) {
  return api.put('/admin/store', { [key]: url });
}

export async function updateStoreProfile(updates: Record<string, any>) {
  return api.put('/admin/store', updates);
}

export async function updateStoreOperations(updates: { key: string; value: string }[]) {
  return api.patch('/admin/store/settings', { settings: updates });
}

export async function updateSettingsGroup(group: string, data: Record<string, any>) {
  return api.put(`/admin/settings/${group}`, data);
}
