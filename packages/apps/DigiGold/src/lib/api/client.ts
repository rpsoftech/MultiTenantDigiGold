import axios, { type InternalAxiosRequestConfig } from 'axios';

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
    | { message?: unknown; error?: unknown }
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
    code: axiosError?.code ?? 'UNKNOWN_ERROR',
    status: axiosError?.response?.status ?? null,
  };
}

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
  if (isProtectedAdminEndpoint(config.url)) {
    const adminConfig = config as AdminRetryConfig;
    const sessionId = getAdminSessionId();
    if (adminConfig.adminSessionId === undefined) {
      adminConfig.adminSessionId = sessionId;
    } else if (adminConfig.adminSessionId !== sessionId) {
      throw adminSessionChangedError();
    }
  }

  const tenantUuid = process.env.NEXT_PUBLIC_TENANT_UUID;
  const accessToken = isProtectedAdminEndpoint(config.url)
    ? getAdminAccessToken()
    : typeof window !== 'undefined'
      ? window.localStorage.getItem('access_token')
      : null;

  if (tenantUuid) config.headers.set('X-Tenant-ID', tenantUuid);
  config.headers.delete('X-Api-Token');
  if (accessToken && !isPublicAuthEndpoint(config.url)) {
    config.headers.set('X-Api-Token', accessToken);
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

    if (
      normalizedError.status !== 401 ||
      !config ||
      !isProtectedAdminEndpoint(config.url)
    ) {
      throw normalizedError;
    }

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
