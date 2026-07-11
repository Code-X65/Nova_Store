import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

let _csrfToken: string | null = null;
let _adminAccessToken: string | null = null;

if (typeof window !== 'undefined') {
  _adminAccessToken = localStorage.getItem('admin_access_token');
}

export function setCsrfToken(token: string) {
  _csrfToken = token;
}

export function clearCsrfToken() {
  _csrfToken = null;
}

export function setAdminAccessToken(token: string) {
  _adminAccessToken = token;
}

export function clearAdminAccessToken() {
  _adminAccessToken = null;
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
  });

  // Request interceptor — attach CSRF token for mutations
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? '').toUpperCase();
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (mutating && _csrfToken) {
      if (config.headers.set) config.headers.set('x-csrf-token', _csrfToken);
      else config.headers['x-csrf-token'] = _csrfToken;
    }
    if (_adminAccessToken) {
      if (config.headers.set) config.headers.set('Authorization', `Bearer ${_adminAccessToken}`);
      else config.headers['Authorization'] = `Bearer ${_adminAccessToken}`;
    }
    return config;
  });

  // Response interceptor — handle 401 globally
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        clearCsrfToken();
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          // Public pages (login, accept-invite) must not be bounced to /login
          // on an expected 401 (e.g. the initial session-verification probe).
          const isPublicRoute = path.endsWith('/login') || path.startsWith('/accept-invite');
          if (!isPublicRoute) {
            try {
              const channel = new BroadcastChannel('admin-session-channel');
              channel.postMessage('LOGOUT');
              channel.close();
            } catch (e) {
              // ignore
            }
            // Redirect to admin login unless already there
            if (!path.endsWith('/login')) {
              const isAdminPath = path.startsWith('/admin');
              window.location.href = isAdminPath ? '/admin/login' : '/login';
            }
          }
        }
      } else if (error.response?.status === 423) {
        if (typeof window !== 'undefined') {
          try {
            const channel = new BroadcastChannel('admin-session-channel');
            channel.postMessage('ACCOUNT_LOCKED');
            channel.close();
          } catch (e) {
            // ignore
          }
          // Optionally dispatch a custom event on window so React components can listen
          window.dispatchEvent(new CustomEvent('account-locked'));
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}
