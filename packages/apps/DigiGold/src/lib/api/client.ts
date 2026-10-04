import axios, { type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, clearTokens } from '@/lib/auth/tokenStorage';
import { emitSessionExpired } from '@/lib/auth/sessionEvents';
import { isJwtExpired } from '@/lib/utils/jwt';

import {
  clearAdminTokens,
  getAdminAccessToken,
  getAdminRefreshToken,
  getAdminSessionId,
  getAdminTokenRevision,
  rotateAdminTokens,
  type AdminTokens,
} from './admin-tokens';

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
// (see interfaces/req-interfaces.go RequestError); some handlers still answer
// { error: <string> }. `name` (e.g. ERROR_RECENT_OTP_REQ_EXIST, RATE_LIMITED) is the
// stable identifier callers should switch on — prefer it over axios's own transport-level
// error.code, which only ever says something like "ERR_BAD_REQUEST". Errors that are
// already normalized (e.g. a failed admin refresh re-thrown by a retry) pass through.
function normalizeApiError(error: unknown): NormalizedApiError {
  if (
    !axios.isAxiosError(error) &&
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'status' in error &&
    (typeof error.status === 'number' || error.status === null)
  ) {
    return error as NormalizedApiError;
  }

  const axiosError = axios.isAxiosError(error) ? error : undefined;
  const responseData = axiosError?.response?.data as
    | { message?: unknown; error?: unknown; name?: unknown }
    | undefined;

  return {
    message:
      typeof responseData?.message === 'string'
        ? responseData.message
        : typeof responseData?.error === 'string'
          ? responseData.error
          : error instanceof Error
            ? error.message
            : 'The request failed.',
    code:
      typeof responseData?.name === 'string'
        ? responseData.name
        : (axiosError?.code ?? 'UNKNOWN_ERROR'),
    status: axiosError?.response?.status ?? null,
  };
}

// Admin and customer sessions are separate: /admin/* (except its public auth routes) uses
// the admin tokens in admin-tokens.ts with refresh-and-retry; everything else uses the
// customer token in tokenStorage.ts, which has no refresh endpoint and expires the
// session instead.
function isProtectedAdminEndpoint(url: string | undefined): boolean {
  return url?.startsWith('/admin/') === true && !isPublicAuthEndpoint(url);
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
  if (tenantUuid) config.headers.set('X-Tenant-ID', tenantUuid);
  // Never forward a token the caller (or a retried config) carried in; set it fresh below.
  config.headers.delete('X-Api-Token');

  if (isPublicAuthEndpoint(config.url)) return config;

  if (isProtectedAdminEndpoint(config.url)) {
    const adminConfig = config as AdminRetryConfig;
    const sessionId = getAdminSessionId();
    if (adminConfig.adminSessionId === undefined) {
      adminConfig.adminSessionId = sessionId;
    } else if (adminConfig.adminSessionId !== sessionId) {
      throw adminSessionChangedError();
    }

    // Never fall back to the customer token for an admin route.
    const adminToken = getAdminAccessToken();
    if (adminToken) config.headers.set('X-Api-Token', adminToken);
    return config;
  }

  const accessToken = getAccessToken();
  if (accessToken && !isJwtExpired(accessToken)) {
    config.headers.set('X-Api-Token', accessToken);
  } else if (accessToken) {
    // Token expired client-side — there's no customer-facing refresh endpoint to fall
    // back to. Clear it without redirecting: this request may be a public one, and if it
    // isn't, the server's 401 below triggers the redirect.
    clearTokens();
    emitSessionExpired('expired');
  }

  return config;
});

function adminSessionChangedError(): NormalizedApiError {
  return {
    message: 'The admin session changed while the request was pending.',
    code: 'ADMIN_SESSION_CHANGED',
    status: 401,
  };
}

function expireAdminSession(
  revision: number,
  refreshToken: string | null,
  sessionId: string | null,
): void {
  if (
    getAdminTokenRevision() !== revision ||
    getAdminRefreshToken() !== refreshToken ||
    getAdminSessionId() !== sessionId
  ) {
    return;
  }

  clearAdminTokens();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('admin-session-expired'));
  }
}

let pendingAdminRefresh:
  | {
      revision: number;
      token: string;
      sessionId: string | null;
      promise: Promise<AdminTokens>;
    }
  | undefined;

export function refreshAdminTokens(): Promise<AdminTokens> {
  const refreshToken = getAdminRefreshToken();
  const revision = getAdminTokenRevision();
  const sessionId = getAdminSessionId();

  if (!refreshToken) {
    expireAdminSession(revision, refreshToken, sessionId);
    return Promise.reject({
      message: 'Your admin session has expired. Please sign in again.',
      code: 'ADMIN_SESSION_EXPIRED',
      status: 401,
    } satisfies NormalizedApiError);
  }

  if (
    pendingAdminRefresh?.token === refreshToken &&
    pendingAdminRefresh.revision === revision &&
    pendingAdminRefresh.sessionId === sessionId
  ) {
    return pendingAdminRefresh.promise;
  }

  const promise = apiClient
    .post<AdminTokens>('/admin/auth/refresh', { refresh_token: refreshToken })
    .then(({ data }) => {
      if (
        getAdminTokenRevision() !== revision ||
        getAdminRefreshToken() !== refreshToken ||
        getAdminSessionId() !== sessionId
      ) {
        throw adminSessionChangedError();
      }

      if (
        typeof data?.access_token !== 'string' ||
        !data.access_token ||
        typeof data?.refresh_token !== 'string' ||
        !data.refresh_token
      ) {
        throw {
          message: 'The server returned an invalid admin session.',
          code: 'INVALID_ADMIN_SESSION',
          status: 401,
        } satisfies NormalizedApiError;
      }

      rotateAdminTokens(data);
      return data;
    })
    .catch((error: unknown) => {
      const normalizedError = normalizeApiError(error);
      if (
        normalizedError.status === 400 ||
        normalizedError.status === 401 ||
        normalizedError.status === 403
      ) {
        expireAdminSession(revision, refreshToken, sessionId);
      }
      throw normalizedError;
    })
    .finally(() => {
      if (pendingAdminRefresh?.promise === promise) {
        pendingAdminRefresh = undefined;
      }
    });

  pendingAdminRefresh = { revision, token: refreshToken, sessionId, promise };
  return promise;
}

type AdminRetryConfig = InternalAxiosRequestConfig & {
  adminAuthRetried?: boolean;
  adminSessionId?: string | null;
};


apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const normalizedError = normalizeApiError(error);
    const config = (axios.isAxiosError(error) ? error.config : undefined) as
      | AdminRetryConfig
      | undefined;

    if (normalizedError.status !== 401 || !config) throw normalizedError;

    // Customer routes: no refresh endpoint exists, so a 401 ends the customer session.
    if (!isProtectedAdminEndpoint(config.url)) {
      if (!isPublicAuthEndpoint(config.url)) {
        clearTokens();
        emitSessionExpired('rejected');
      }
      throw normalizedError;
    }

    // Admin routes: refresh once and retry, without ever touching the customer session.
    if (config.adminSessionId !== getAdminSessionId()) {
      throw adminSessionChangedError();
    }

    if (config.adminAuthRetried) {
      // Do not let an older request invalidate a newly established session.
      if (config.headers.get('X-Api-Token') === getAdminAccessToken()) {
        expireAdminSession(
          getAdminTokenRevision(),
          getAdminRefreshToken(),
          getAdminSessionId(),
        );
      }
      throw normalizedError;
    }

    config.adminAuthRetried = true;
    const currentToken = getAdminAccessToken();
    // Another request may already have rotated the token before this 401 arrived.
    if (!currentToken || config.headers.get('X-Api-Token') === currentToken) {
      await refreshAdminTokens();
    }

    return apiClient.request(config);
  },
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
