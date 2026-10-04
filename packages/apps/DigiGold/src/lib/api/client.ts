import axios, { type AxiosError } from 'axios';
import { getAccessToken, clearTokens } from '@/lib/auth/tokenStorage';
import { emitSessionExpired } from '@/lib/auth/sessionEvents';
import { isJwtExpired } from '@/lib/utils/jwt';

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

// MainServer's error body is { success, message, code: <int>, name: <string>, extra }
// (see interfaces/req-interfaces.go RequestError). `name` (e.g. ERROR_RECENT_OTP_REQ_EXIST,
// RATE_LIMITED) is the stable identifier callers should switch on — prefer it over axios's
// own transport-level error.code, which only ever says something like "ERR_BAD_REQUEST".
function normalizeApiError(error: AxiosError): NormalizedApiError {
  const responseData = error.response?.data as
    | { message?: unknown; name?: unknown }
    | undefined;

  return {
    message:
      typeof responseData?.message === 'string'
        ? responseData.message
        : error.message,
    code:
      typeof responseData?.name === 'string'
        ? responseData.name
        : error.code ?? 'UNKNOWN_ERROR',
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
  const accessToken = getAccessToken();
  const tokenIsUsable = accessToken && !isJwtExpired(accessToken);

  if (tenantUuid) config.headers.set('X-Tenant-ID', tenantUuid);
  if (tokenIsUsable && !isPublicAuthEndpoint(config.url)) {
    config.headers.set('X-Api-Token', accessToken);
  } else if (accessToken && !tokenIsUsable) {
    // Token expired client-side — there's no customer-facing refresh endpoint to fall
    // back to. Clear it without redirecting: this request may be a public one, and if it
    // isn't, the server's 401 below triggers the redirect.
    clearTokens();
    emitSessionExpired('expired');
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !isPublicAuthEndpoint(error.config?.url)) {
      clearTokens();
      emitSessionExpired('rejected');
    }
    return Promise.reject(normalizeApiError(error));
  },
);
