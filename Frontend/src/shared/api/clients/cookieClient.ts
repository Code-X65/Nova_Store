import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

// CSRF token stored in module scope — fetched once per session
let _csrfToken: string | null = null;

export function setCsrfToken(token: string) {
  _csrfToken = token;
}

export function clearCsrfToken() {
  _csrfToken = null;
}

/**
 * Creates an Axios instance for the admin SPA.
 * - Sends session cookie on every request (`withCredentials: true`)
 * - Injects `x-csrf-token` header on all state-changing requests
 * - On 401 → clears csrf token and redirects to /login
 */
export function createCookieClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    withCredentials: true,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor — attach CSRF token for mutations
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? '').toUpperCase();
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (mutating && _csrfToken) {
      config.headers['x-csrf-token'] = _csrfToken;
    }
    return config;
  });

  // Response interceptor — handle 401 globally
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        clearCsrfToken();
        // Redirect to admin login unless already there
        if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
          const isAdminPath = window.location.pathname.startsWith('/admin');
          window.location.href = isAdminPath ? '/admin/login' : '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}
