import { createCookieClient, setCsrfToken, clearCsrfToken, setAdminAccessToken, clearAdminAccessToken } from '@/shared/api';

// Ã¢â€â‚¬Ã¢â€â‚¬ Singleton admin API client Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const BASE_URL = import.meta.env.VITE_ADMIN_API_URL || '/api/v1';

export const api = createCookieClient(BASE_URL);

/**
 * Fetch a fresh CSRF token from the server and store it for mutation requests.
 * Call this once after login/verify.
 */
export async function refreshCsrfToken(): Promise<void> {
  const { data } = await api.get<{ success: boolean; csrfToken: string }>('/auth/csrf-token');
  const token = data?.csrfToken;
  if (token) setCsrfToken(token);
}

export { setCsrfToken, clearCsrfToken, setAdminAccessToken, clearAdminAccessToken };