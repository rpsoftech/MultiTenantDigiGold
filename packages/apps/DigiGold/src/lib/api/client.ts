import axios, { type AxiosError } from 'axios';

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
  const accessToken =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('access_token')
      : null;

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
