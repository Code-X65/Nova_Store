import { api } from '@/admin/lib/api';

export interface TwoFactorStatus {
  enabled: boolean;
  last_verified_at?: string | null;
  recovery_codes_remaining?: number;
  backup_codes_used?: number;
}

export interface TwoFactorSetup {
  totp_secret: string;
  otpauth_url: string;
  qr_code_url: string;
  recovery_codes: string[];
}

export async function fetch2faStatus(): Promise<TwoFactorStatus> {
  const { data } = await api.get<{ success: boolean; data: TwoFactorStatus }>('/admin/security/2fa/status');
  return data.data;
}

export async function enable2fa(): Promise<TwoFactorSetup> {
  const { data } = await api.post<{ success: boolean; data: TwoFactorSetup }>('/admin/security/2fa/enable');
  return data.data;
}

export async function verify2fa(token: string) {
  await api.post('/admin/security/2fa/verify', { token });
}

export async function disable2fa(password: string) {
  await api.post('/admin/security/2fa/disable', { password });
}

export async function redeem2faRecoveryCode(code: string): Promise<{ remaining: number }> {
  const { data } = await api.post<{ success: boolean; data: { remaining: number } }>('/admin/security/2fa/recovery', { code });
  return data.data;
}
