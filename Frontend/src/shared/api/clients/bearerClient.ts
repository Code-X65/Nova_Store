import axios, { type AxiosInstance } from 'axios';

// In-memory access token (never persisted to localStorage in this impl)
let _accessToken: string | null = null;
let _refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

/**
 * Creates an Axios instance for the customer storefront SPA.
 * - Attaches `Authorization: Bearer <token>` on every request
 * - On 401 → tries refresh once; on failure → clears token + redirects to /login
 */
export function createBearerClient(baseURL: string, refreshFn?: () => Promise<string>): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor — attach Bearer token
  client.interceptors.request.use((config) => {
    if (_accessToken) {
      config.headers['Authorization'] = `Bearer ${_accessToken}`;
    }
    return config;
  });

  // Response interceptor — attempt token refresh on 401
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      if (error.response?.status === 401 && !original._retried && refreshFn) {
        original._retried = true;
        try {
          if (!_refreshPromise) {
            _refreshPromise = refreshFn().finally(() => { _refreshPromise = null; });
          }
          const newToken = await _refreshPromise;
          setAccessToken(newToken);
          original.headers['Authorization'] = `Bearer ${newToken}`;
          return client(original);
        } catch {
          clearAccessToken();
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}
