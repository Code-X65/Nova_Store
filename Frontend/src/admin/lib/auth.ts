import { api, refreshCsrfToken, clearCsrfToken, setAdminAccessToken, clearAdminAccessToken } from './api';
import type { AdminSession } from '@/shared/api';

export interface LoginCredentials {
  email: string;
  password: string;
  twoFactorToken?: string;
  recoveryCode?: string;
}

export interface TwoFactorRequiredError {
  code: 'TWO_FACTOR_REQUIRED';
  message: string;
}

/**
 * POST /api/v1/admin/login
 * Sets the session cookie server-side; we then fetch CSRF and verify session.
 */
export async function login(credentials: LoginCredentials): Promise<AdminSession> {
  const { data } = await api.post('/admin/login', credentials);
  if (data?.data?.accessToken) {
    setAdminAccessToken(data.data.accessToken);
    localStorage.setItem('admin_access_token', data.data.accessToken);
  }
  await refreshCsrfToken();
  return verify();
}

/**
 * GET /api/v1/admin/verify
 * Returns the current admin session. Throws 401 if no valid session.
 */
export async function verify(): Promise<AdminSession> {
  const { data } = await api.get<{ data: AdminSession }>('/admin/verify');
  return data.data;
}

/**
 * POST /api/v1/admin/logout
 * Clears the session cookie and local CSRF token.
 */
export async function logout(): Promise<void> {
  try {
    await api.post('/admin/logout');
  } finally {
    clearCsrfToken();
    clearAdminAccessToken();
    localStorage.removeItem('admin_access_token');
  }
}