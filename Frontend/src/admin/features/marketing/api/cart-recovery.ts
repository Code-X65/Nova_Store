import { api } from '@/admin/lib/api';

export interface CartRecoveryLog {
  id: string;
  cart_id: string;
  user_id: string;
  reminder_stage: number;
  sent_at: string;
  recovered: boolean;
  recovered_at: string | null;
  user?: { id: string; first_name: string; last_name: string; email: string };
}

export interface CartRecoverySettings {
  enabled: boolean;
  delayHours: number;
}

export async function fetchAbandonedCarts(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get('/admin/cart-recovery', { params });
  return data.data as { data: CartRecoveryLog[]; count: number; page: number; limit: number };
}

export async function fetchCartRecoverySettings() {
  const { data } = await api.get('/admin/cart-recovery/settings');
  return data.data.settings as CartRecoverySettings;
}

export async function updateCartRecoverySettings(payload: Partial<CartRecoverySettings>) {
  const { data } = await api.patch('/admin/cart-recovery/settings', payload);
  return data.data.settings as CartRecoverySettings;
}

export async function triggerCartRecoveryNow() {
  const { data } = await api.post('/admin/cart-recovery/trigger');
  return data.data as { sent: number; scanned: number };
}
