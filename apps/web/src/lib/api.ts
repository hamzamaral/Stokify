import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types/api';
import { tokenStorage } from './token-storage';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;
let onSessionExpired: () => void = () => undefined;

export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

/** Aynı anda birden fazla 401 gelirse yalnızca tek bir refresh isteği atılır. */
function refreshAccessToken(): Promise<string> {
  refreshPromise ??= (async () => {
    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) throw new Error('Refresh token yok');
    const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
    tokenStorage.set(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        tokenStorage.clear();
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiError>(error)) {
    const data = error.response?.data;
    if (data?.details && Array.isArray(data.details)) return data.details.join(', ');
    if (data?.message) return data.message;
    if (error.code === 'ECONNABORTED') return 'İstek zaman aşımına uğradı';
    if (!error.response) return 'Sunucuya ulaşılamıyor';
  }
  return error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu';
}

export async function downloadFile(url: string, filename: string) {
  const response = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(response.data);
  const link = Object.assign(document.createElement('a'), { href, download: filename });
  link.click();
  URL.revokeObjectURL(href);
}
