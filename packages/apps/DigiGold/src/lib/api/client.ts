import axios, { type AxiosError } from 'axios';
import { readStoredAccessToken } from '@/lib/auth/tokenStorage';

export type NormalizedApiError = {
  message: string;
  code: string;
  status: number | null;
};

export function normalizeApiBaseURL(
  baseURL: string | undefined,
): string | undefined {
  if (!baseURL) return undefined;

  const trimmedBaseURL = baseURL.replace(/\/+$/, '');
  if (trimmedBaseURL.endsWith('/api/v1')) return trimmedBaseURL;
  if (trimmedBaseURL.endsWith('/api')) return `${trimmedBaseURL}/v1`;

  return `${trimmedBaseURL}/api/v1`;
}

function normalizeApiError(error: AxiosError): NormalizedApiError {
  const responseData = error.response?.data as
    | { message?: unknown }
    | undefined;

  return {
    message:
      typeof responseData?.message === 'string'
        ? responseData.message
        : error.message,
    code: error.code ?? 'UNKNOWN_ERROR',
    status: error.response?.status ?? null,
  };
}

function isPublicAuthEndpoint(url: string | undefined): boolean {
  return (
    url?.startsWith('/auth/') === true ||
    url?.startsWith('/admin/auth/') === true
  );
}

export const apiClient = axios.create({
  baseURL: normalizeApiBaseURL(process.env.NEXT_PUBLIC_API_BASE_URL),
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const tenantUuid = process.env.NEXT_PUBLIC_TENANT_UUID;
  const accessToken = readStoredAccessToken();

  if (tenantUuid) config.headers.set('X-Tenant-ID', tenantUuid);
  if (accessToken && !isPublicAuthEndpoint(config.url)) {
    config.headers.set('X-Api-Token', accessToken);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(normalizeApiError(error)),
);

// The interceptor above rejects with a plain NormalizedApiError object, not an Error, so
// `error instanceof Error` is false for every API failure. Without this guard, consumers
// silently fall back to generic copy and hide the real reason (offline, 401, 500, timeout).
export function isNormalizedApiError(
  error: unknown,
): error is NormalizedApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'code' in error &&
    'status' in error
  );
}

// Turns a failed request into something a customer can act on. Axios's own messages
// ("Network Error", "timeout of 15000ms exceeded") are developer-facing, so they are mapped
// to plain language; a server-supplied message is passed through untouched since the API
// already writes them for humans.
export function describeApiError(error: unknown): string | null {
  if (!isNormalizedApiError(error)) {
    if (error instanceof Error) return error.message;
    return null;
  }

  if (error.status === null) {
    return error.code === 'ECONNABORTED'
      ? 'The server took too long to respond. Please try again.'
      : "Can't reach the server. Check your connection and try again.";
  }

  if (error.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (error.status >= 500) {
    return 'The server is having trouble right now. Please try again shortly.';
  }

  return error.message;
}
