import axios, { type InternalAxiosRequestConfig } from 'axios';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '@/lib/auth/tokenStorage';
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
  // MainServer's optional `extra` details, e.g. { attempts_left } on a wrong pickup code.
  extra?: unknown;
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
    | { message?: unknown; error?: unknown; name?: unknown; extra?: unknown }
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
    ...(responseData?.extra !== undefined && { extra: responseData.extra }),
  };
}

// Admin and customer sessions are separate: /admin/* (except its public auth routes) uses
// the admin tokens in admin-tokens.ts, everything else the customer tokens in
// tokenStorage.ts. Both refresh an expired access token (single-use refresh tokens) and
// retry a rejected request once.
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

apiClient.interceptors.request.use(async (config) => {
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

  let accessToken = getAccessToken();
  if (accessToken && isJwtExpired(accessToken)) {
    // Renew it first (the access token lasts 15 minutes). If the session can't be renewed,
    // clear it without redirecting: this request may be a public one, and if it isn't, the
    // server's 401 below triggers the redirect.
    accessToken = await refreshCustomerTokens();
    if (!accessToken) {
      clearTokens();
      emitSessionExpired('expired');
    }
  }
  if (accessToken) config.headers.set('X-Api-Token', accessToken);

  return config;
});

const CUSTOMER_REFRESH_LOCK = 'digigold-customer-refresh';

let pendingCustomerRefresh:
  | { token: string; promise: Promise<string | null> }
  | undefined;

// Exchanges the customer's refresh token for a new pair and returns the new access token,
// or null when the session can't be renewed (no refresh token, or MainServer rejected it).
// Refresh tokens are single use, so concurrent requests share one exchange and tabs take
// turns under a lock; a tab that waited adopts the pair the other one stored. A transient
// failure (offline, 5xx) is thrown and leaves the tokens in place.
export function refreshCustomerTokens(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  // Mock sign-in has no MainServer session to renew.
  if (!refreshToken || process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true') {
    return Promise.resolve(null);
  }
  if (pendingCustomerRefresh?.token === refreshToken) {
    return pendingCustomerRefresh.promise;
  }

  const adoptRotated = (): string | null => {
    const latestRefresh = getRefreshToken();
    const latestAccess = getAccessToken();
    return latestRefresh &&
      latestRefresh !== refreshToken &&
      latestAccess &&
      !isJwtExpired(latestAccess)
      ? latestAccess
      : null;
  };

  const promise = withRefreshLock(CUSTOMER_REFRESH_LOCK, async () => {
    if (getRefreshToken() !== refreshToken) return adoptRotated();

    const { data } = await apiClient.post<{
      access_token?: unknown;
      refresh_token?: unknown;
    }>('/auth/refresh', { refresh_token: refreshToken });
    // Signed out (or another customer signed in) while the exchange was in flight.
    if (getRefreshToken() !== refreshToken) return null;
    if (
      typeof data?.access_token !== 'string' ||
      !data.access_token ||
      typeof data?.refresh_token !== 'string' ||
      !data.refresh_token
    ) {
      return null;
    }
    setTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });
    return data.access_token;
  })
    .catch((error: unknown) => {
      const rotated = adoptRotated();
      if (rotated) return rotated;
      const normalizedError = normalizeApiError(error);
      if (
        normalizedError.status === 400 ||
        normalizedError.status === 401 ||
        normalizedError.status === 403
      ) {
        return null;
      }
      throw normalizedError;
    })
    .finally(() => {
      if (pendingCustomerRefresh?.promise === promise) {
        pendingCustomerRefresh = undefined;
      }
    });

  pendingCustomerRefresh = { token: refreshToken, promise };
  return promise;
}

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

const ADMIN_REFRESH_LOCK = 'digigold-admin-refresh';

// Runs `task` while holding a lock shared by every tab of this origin (Web Locks API).
// Where the API is missing (old browsers, jsdom) the task runs directly; the
// adopt-after-rejection fallbacks in the refresh functions then cover most cross-tab races.
function withRefreshLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks?.request) return task();
  return locks.request(name, task);
}

function withAdminRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  return withRefreshLock(ADMIN_REFRESH_LOCK, task);
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

  // Refresh tokens are single use, and every tab of a session shares them through
  // localStorage. Holding a cross-tab lock for the whole exchange means only one tab talks
  // to MainServer at a time; a tab that waited re-reads the stored token and adopts the
  // pair the other tab just stored, instead of sending the consumed one and being signed out.
  const promise = withAdminRefreshLock(async (): Promise<AdminTokens> => {
    const storedRefresh = getAdminRefreshToken();
    if (storedRefresh !== refreshToken) {
      const storedAccess = getAdminAccessToken();
      if (storedRefresh && storedAccess && getAdminSessionId() === sessionId) {
        return { access_token: storedAccess, refresh_token: storedRefresh };
      }
      // Logged out, or another admin signed in, while this tab waited.
      throw adminSessionChangedError();
    }

    const { data } = await apiClient.post<AdminTokens>('/admin/auth/refresh', {
      refresh_token: refreshToken,
    });
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
      // Refresh tokens are single use (MainServer consumes them), and tabs share
      // localStorage. If another tab of this same session rotated the pair first, our
      // refresh was rejected (or the session "changed" mid-flight) — adopt the pair it
      // stored instead of failing the request or signing the admin out. A logout (no
      // tokens) or a different sign-in (new session id) still falls through to failure.
      const latestAccess = getAdminAccessToken();
      const latestRefresh = getAdminRefreshToken();
      if (
        latestAccess &&
        latestRefresh &&
        latestRefresh !== refreshToken &&
        getAdminSessionId() === sessionId
      ) {
        return { access_token: latestAccess, refresh_token: latestRefresh };
      }

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
  customerAuthRetried?: boolean;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const normalizedError = normalizeApiError(error);
    const config = (axios.isAxiosError(error) ? error.config : undefined) as
      | AdminRetryConfig
      | undefined;

    if (normalizedError.status !== 401 || !config) throw normalizedError;

    // Customer routes: renew the session and retry once; a second 401, or a session that
    // can't be renewed, ends it.
    if (!isProtectedAdminEndpoint(config.url)) {
      if (isPublicAuthEndpoint(config.url)) throw normalizedError;

      const sentToken = config.headers.get('X-Api-Token');
      if (!config.customerAuthRetried && getRefreshToken()) {
        config.customerAuthRetried = true;
        const current = getAccessToken();
        let renewed: string | null;
        try {
          // Another request may already have renewed the token before this 401 arrived.
          renewed =
            current && current !== sentToken && !isJwtExpired(current)
              ? current
              : await refreshCustomerTokens();
        } catch {
          throw normalizedError; // Transient: keep the session.
        }
        if (renewed) return apiClient.request(config);
      }

      // Do not let an older request end a session that was renewed (or started) since.
      const current = getAccessToken();
      if (
        current &&
        sentToken &&
        current !== sentToken &&
        !isJwtExpired(current)
      ) {
        throw normalizedError;
      }
      clearTokens();
      emitSessionExpired('rejected');
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
