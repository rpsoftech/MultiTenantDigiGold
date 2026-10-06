import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  clearAdminTokens,
  getAdminAccessToken,
  getAdminRefreshToken,
  getAdminSessionId,
  storeAdminTokens,
} from './admin-tokens';
import {
  apiClient,
  describeApiError,
  isNormalizedApiError,
  normalizeApiBaseURL,
  refreshAdminTokens,
} from './client';

describe('normalizeApiBaseURL', () => {
  it('leaves an undefined base URL unset', () => {
    expect(normalizeApiBaseURL(undefined)).toBeUndefined();
  });

  it('adds the backend API version when the origin is provided', () => {
    expect(normalizeApiBaseURL('http://localhost:8080')).toBe(
      'http://localhost:8080/api/v1',
    );
  });

  it('adds only the version when the API root is provided', () => {
    expect(normalizeApiBaseURL('http://localhost:8080/api')).toBe(
      'http://localhost:8080/api/v1',
    );
  });

  it('does not duplicate the API version when it is already configured', () => {
    expect(normalizeApiBaseURL('http://localhost:8080/api/v1')).toBe(
      'http://localhost:8080/api/v1',
    );
  });

  it('normalizes trailing slashes before checking the API version', () => {
    expect(normalizeApiBaseURL('http://localhost:8080/api/v1/')).toBe(
      'http://localhost:8080/api/v1',
    );
  });
});

function response(
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse {
  return { config, data, status, statusText: '', headers: new AxiosHeaders() };
}

function httpError(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown = { error: 'Unauthorized' },
): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    undefined,
    response(config, data, status),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('admin API authentication', () => {
  const originalAdapter = apiClient.defaults.adapter;
  const originalTenantUuid = process.env.NEXT_PUBLIC_TENANT_UUID;
  const initialTokens = {
    access_token: 'admin-access',
    refresh_token: 'admin-refresh',
  };
  const rotatedTokens = {
    access_token: 'rotated-access',
    refresh_token: 'rotated-refresh',
  };

  beforeEach(() => {
    window.localStorage.clear();
    clearAdminTokens();
    window.localStorage.setItem('access_token', 'customer-access');
    window.localStorage.setItem('refresh_token', 'customer-refresh');
    storeAdminTokens(initialTokens);
    process.env.NEXT_PUBLIC_TENANT_UUID = 'tenant-id';
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    clearAdminTokens();
    window.localStorage.clear();
    if (originalTenantUuid === undefined) {
      delete process.env.NEXT_PUBLIC_TENANT_UUID;
    } else {
      process.env.NEXT_PUBLIC_TENANT_UUID = originalTenantUuid;
    }
    jest.restoreAllMocks();
  });

  it('separates customer/admin headers and omits access tokens on auth endpoints', async () => {
    const headers: Record<string, unknown>[] = [];
    apiClient.defaults.adapter = async (config) => {
      headers.push(config.headers.toJSON());
      return response(config, {});
    };

    await apiClient.get('/admin/users');
    await apiClient.get('/wallet');
    await apiClient.post(
      '/admin/auth/totp/verify',
      {},
      {
        headers: { 'X-Api-Token': 'stale-token' },
      },
    );
    await apiClient.post('/auth/login');

    expect(headers.map((header) => header['X-Api-Token'])).toEqual([
      'admin-access',
      'customer-access',
      undefined,
      undefined,
    ]);
    expect(
      headers.every((header) => header['X-Tenant-ID'] === 'tenant-id'),
    ).toBe(true);
  });

  it('never falls back to customer credentials for an admin request', async () => {
    clearAdminTokens();
    apiClient.defaults.adapter = async (config) => {
      expect(config.headers.get('X-Api-Token')).toBeUndefined();
      return response(config, {});
    };

    await apiClient.get('/admin/users');
  });

  it('preserves server error messages and statuses without refreshing auth endpoints', async () => {
    let requests = 0;
    apiClient.defaults.adapter = async (config) => {
      requests += 1;
      throw httpError(config, 401, { error: 'Invalid username or password' });
    };

    await expect(apiClient.post('/admin/auth/login')).rejects.toEqual({
      message: 'Invalid username or password',
      code: 'ERR_BAD_REQUEST',
      status: 401,
    });
    expect(requests).toBe(1);
    expect(getAdminAccessToken()).toBe('admin-access');
  });

  it('still supports message-shaped server errors and leaves customer failures alone', async () => {
    let requests = 0;
    apiClient.defaults.adapter = async (config) => {
      requests += 1;
      throw httpError(config, 401, { message: 'Customer session expired' });
    };

    await expect(apiClient.get('/wallet')).rejects.toMatchObject({
      message: 'Customer session expired',
      status: 401,
    });
    expect(requests).toBe(1);
    expect(getAdminRefreshToken()).toBe('admin-refresh');
  });

  it('deduplicates simultaneous refreshes, persists rotation, and retries requests', async () => {
    const originalSessionId = getAdminSessionId();
    const refreshStarted = deferred<void>();
    const completeRefresh = deferred<void>();
    let refreshes = 0;
    let protectedRequests = 0;
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/admin/auth/refresh') {
        refreshes += 1;
        expect(JSON.parse(config.data)).toEqual({
          refresh_token: 'admin-refresh',
        });
        expect(config.headers.get('X-Api-Token')).toBeUndefined();
        refreshStarted.resolve();
        await completeRefresh.promise;
        return response(config, rotatedTokens);
      }

      protectedRequests += 1;
      if (config.headers.get('X-Api-Token') === 'admin-access') {
        throw httpError(config, 401);
      }
      expect(config.headers.get('X-Api-Token')).toBe('rotated-access');
      return response(config, { ok: true });
    };

    const requests = [
      apiClient.get('/admin/users'),
      apiClient.get('/admin/profile'),
    ];
    await refreshStarted.promise;
    const explicitRefresh = refreshAdminTokens();
    completeRefresh.resolve();

    await expect(Promise.all(requests)).resolves.toHaveLength(2);
    await expect(explicitRefresh).resolves.toEqual(rotatedTokens);
    expect(refreshes).toBe(1);
    expect(protectedRequests).toBe(4);
    expect(getAdminAccessToken()).toBe('rotated-access');
    expect(getAdminRefreshToken()).toBe('rotated-refresh');
    expect(getAdminSessionId()).toBe(originalSessionId);
    expect(window.localStorage.getItem('access_token')).toBe('customer-access');
  });

  it('uses an already rotated token when an older request returns a late 401', async () => {
    const lateRequestStarted = deferred<void>();
    const releaseLateRequest = deferred<void>();
    let refreshes = 0;
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/admin/auth/refresh') {
        refreshes += 1;
        return response(config, rotatedTokens);
      }
      if (config.headers.get('X-Api-Token') === 'admin-access') {
        if (config.url === '/admin/slow') {
          lateRequestStarted.resolve();
          await releaseLateRequest.promise;
        }
        throw httpError(config, 401);
      }
      return response(config, {});
    };

    const slowRequest = apiClient.get('/admin/slow');
    await lateRequestStarted.promise;
    await apiClient.get('/admin/fast');
    releaseLateRequest.resolve();
    await slowRequest;
    expect(refreshes).toBe(1);
  });

  it('expires only the admin session after refresh rejection without recursing', async () => {
    const expired = jest.fn();
    window.addEventListener('admin-session-expired', expired);
    let requests = 0;
    apiClient.defaults.adapter = async (config) => {
      requests += 1;
      throw httpError(config, 401, { error: 'Refresh token expired' });
    };

    try {
      await expect(apiClient.get('/admin/users')).rejects.toMatchObject({
        message: 'Refresh token expired',
        status: 401,
      });
      expect(requests).toBe(2);
      expect(expired).toHaveBeenCalledTimes(1);
      expect(getAdminAccessToken()).toBeNull();
      expect(getAdminRefreshToken()).toBeNull();
      expect(window.localStorage.getItem('access_token')).toBe(
        'customer-access',
      );
      expect(window.localStorage.getItem('refresh_token')).toBe(
        'customer-refresh',
      );
    } finally {
      window.removeEventListener('admin-session-expired', expired);
    }
  });

  it('stops after one retry when the rotated access token is also rejected', async () => {
    let refreshes = 0;
    let protectedRequests = 0;
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/admin/auth/refresh') {
        refreshes += 1;
        return response(config, rotatedTokens);
      }
      protectedRequests += 1;
      throw httpError(config, 401);
    };

    await expect(apiClient.get('/admin/users')).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshes).toBe(1);
    expect(protectedRequests).toBe(2);
    expect(getAdminAccessToken()).toBeNull();
  });

  it('keeps credentials when refresh fails transiently', async () => {
    apiClient.defaults.adapter = async (config) => {
      throw httpError(config, config.url === '/admin/auth/refresh' ? 503 : 401);
    };

    await expect(apiClient.get('/admin/users')).rejects.toMatchObject({
      status: 503,
    });
    expect(getAdminAccessToken()).toBe('admin-access');
    expect(getAdminRefreshToken()).toBe('admin-refresh');
  });

  it('does not restore an admin session after logout during refresh', async () => {
    const refreshStarted = deferred<void>();
    const completeRefresh = deferred<void>();
    apiClient.defaults.adapter = async (config) => {
      refreshStarted.resolve();
      await completeRefresh.promise;
      return response(config, rotatedTokens);
    };

    const refreshing = refreshAdminTokens();
    await refreshStarted.promise;
    clearAdminTokens();
    completeRefresh.resolve();

    await expect(refreshing).rejects.toMatchObject({
      code: 'ADMIN_SESSION_CHANGED',
    });
    expect(getAdminAccessToken()).toBeNull();
    expect(getAdminRefreshToken()).toBeNull();
  });

  it('adopts a pair another tab rotated when its own single-use refresh is rejected', async () => {
    const sentTokens: unknown[] = [];
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/admin/auth/refresh') {
        // Another tab of the same session refreshed first: it stored the rotated pair, so
        // MainServer has already consumed the refresh token this tab is sending.
        window.localStorage.setItem(
          'admin_access_token',
          rotatedTokens.access_token,
        );
        window.localStorage.setItem(
          'admin_refresh_token',
          rotatedTokens.refresh_token,
        );
        throw httpError(config, 401, {
          message: 'Your admin session has expired. Please sign in again.',
          name: 'ADMIN_REFRESH_TOKEN_INVALID',
        });
      }
      sentTokens.push(config.headers.get('X-Api-Token'));
      if (config.headers.get('X-Api-Token') === initialTokens.access_token) {
        throw httpError(config, 401);
      }
      return response(config, { ok: true });
    };

    await expect(apiClient.get('/admin/users')).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(sentTokens).toEqual([
      initialTokens.access_token,
      rotatedTokens.access_token,
    ]);
    // The session survives: nothing was cleared.
    expect(getAdminAccessToken()).toBe(rotatedTokens.access_token);
    expect(getAdminRefreshToken()).toBe(rotatedTokens.refresh_token);
  });

  describe('two tabs of one session refreshing at the same moment', () => {
    // A fake MainServer with single-use refresh tokens. A replayed token is rejected at
    // once, while a successful exchange takes a moment: the loser's 401 comes back first,
    // as it does against the real server (GETDEL miss vs. DB read + signing + Redis write).
    function singleUseServer() {
      const live = new Set([initialTokens.refresh_token]);
      const server = {
        exchanges: 0,
        adapter: async (config: InternalAxiosRequestConfig) => {
          if (config.url !== '/admin/auth/refresh') return response(config, {});
          server.exchanges += 1;
          const sent = (
            JSON.parse(config.data as string) as { refresh_token: string }
          ).refresh_token;
          if (!live.delete(sent)) {
            throw httpError(config, 401, {
              message: 'Your admin session has expired. Please sign in again.',
              name: 'ADMIN_REFRESH_TOKEN_INVALID',
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
          live.add(rotatedTokens.refresh_token);
          return response(config, rotatedTokens);
        },
      };
      return server;
    }

    // Each tab has its own copy of the client modules (its own in-memory state) but shares
    // localStorage, exactly like two browser tabs.
    function openSecondTab(): typeof import('./client') {
      let tab!: typeof import('./client');
      jest.isolateModules(() => {
        tab = require('./client') as typeof import('./client');
      });
      return tab;
    }

    afterEach(() => {
      delete (window.navigator as { locks?: unknown }).locks;
    });

    it('exchanges the token once and both tabs keep the session (Web Locks)', async () => {
      // Minimal LockManager: requests for a lock run one after another, across tabs.
      let tail: Promise<unknown> = Promise.resolve();
      Object.defineProperty(window.navigator, 'locks', {
        configurable: true,
        value: {
          request: (_name: string, task: () => Promise<unknown>) => {
            const run = tail.then(task);
            tail = run.catch(() => undefined);
            return run;
          },
        },
      });
      const server = singleUseServer();
      const secondTab = openSecondTab();
      apiClient.defaults.adapter = server.adapter;
      secondTab.apiClient.defaults.adapter = server.adapter;

      const [first, second] = await Promise.all([
        refreshAdminTokens(),
        secondTab.refreshAdminTokens(),
      ]);

      expect(server.exchanges).toBe(1);
      expect(first).toEqual(rotatedTokens);
      expect(second).toEqual(rotatedTokens);
      expect(getAdminAccessToken()).toBe(rotatedTokens.access_token);
      expect(getAdminRefreshToken()).toBe(rotatedTokens.refresh_token);
    });
  });

  it('does not clear a newer session when an older refresh fails', async () => {
    const refreshStarted = deferred<void>();
    const completeRefresh = deferred<void>();
    apiClient.defaults.adapter = async (config) => {
      refreshStarted.resolve();
      await completeRefresh.promise;
      throw httpError(config, 401);
    };

    const refreshing = refreshAdminTokens();
    await refreshStarted.promise;
    clearAdminTokens();
    storeAdminTokens(rotatedTokens);
    completeRefresh.resolve();

    await expect(refreshing).rejects.toMatchObject({ status: 401 });
    expect(getAdminAccessToken()).toBe('rotated-access');
    expect(getAdminRefreshToken()).toBe('rotated-refresh');
  });

  it.each(['this tab', 'another tab'])(
    'never replays an old admin action after signing in as another admin in %s',
    async (location) => {
      const requestStarted = deferred<void>();
      const finishOldRequest = deferred<void>();
      const expired = jest.fn();
      window.addEventListener('admin-session-expired', expired);
      const requests: string[] = [];
      apiClient.defaults.adapter = async (config) => {
        requests.push(config.url ?? '');
        requestStarted.resolve();
        await finishOldRequest.promise;
        throw httpError(config, 401);
      };

      try {
        const oldAction = apiClient.post('/admin/users/user-123/kyc', {
          status: 'approved',
        });
        await requestStarted.promise;
        if (location === 'this tab') {
          clearAdminTokens();
          storeAdminTokens(rotatedTokens);
        } else {
          // A different tab changes shared storage without changing this
          // module's in-memory revision.
          window.localStorage.setItem(
            'admin_session_id',
            'other-admin-session',
          );
          window.localStorage.setItem(
            'admin_access_token',
            rotatedTokens.access_token,
          );
          window.localStorage.setItem(
            'admin_refresh_token',
            rotatedTokens.refresh_token,
          );
        }
        finishOldRequest.resolve();

        await expect(oldAction).rejects.toMatchObject({
          code: 'ADMIN_SESSION_CHANGED',
        });
        expect(requests).toEqual(['/admin/users/user-123/kyc']);
        expect(getAdminAccessToken()).toBe('rotated-access');
        expect(getAdminRefreshToken()).toBe('rotated-refresh');
        expect(expired).not.toHaveBeenCalled();
      } finally {
        window.removeEventListener('admin-session-expired', expired);
      }
    },
  );

  it.each(['success', 'failure'])(
    'does not replace or clear another tab session after an older refresh %s, even with identical token strings',
    async (outcome) => {
      const refreshStarted = deferred<void>();
      const completeRefresh = deferred<void>();
      const expired = jest.fn();
      window.addEventListener('admin-session-expired', expired);
      apiClient.defaults.adapter = async (config) => {
        refreshStarted.resolve();
        await completeRefresh.promise;
        if (outcome === 'failure') throw httpError(config, 401);
        return response(config, rotatedTokens);
      };

      try {
        const refreshing = refreshAdminTokens();
        await refreshStarted.promise;
        // JWTs issued to the same account within one second can be identical.
        window.localStorage.setItem(
          'admin_session_id',
          'new-login-in-another-tab',
        );
        completeRefresh.resolve();

        await expect(refreshing).rejects.toMatchObject({ status: 401 });
        expect(getAdminAccessToken()).toBe('admin-access');
        expect(getAdminRefreshToken()).toBe('admin-refresh');
        expect(getAdminSessionId()).toBe('new-login-in-another-tab');
        expect(expired).not.toHaveBeenCalled();
      } finally {
        window.removeEventListener('admin-session-expired', expired);
      }
    },
  );
});

describe('isNormalizedApiError', () => {
  it('recognises the plain object the response interceptor rejects with', () => {
    // Deliberately not an Error instance — that is exactly what normalizeApiError produces.
    expect(
      isNormalizedApiError({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        status: null,
      }),
    ).toBe(true);
  });

  it('rejects values that are not API errors', () => {
    expect(isNormalizedApiError(new Error('boom'))).toBe(false);
    expect(isNormalizedApiError(null)).toBe(false);
    expect(isNormalizedApiError('nope')).toBe(false);
  });
});

describe('describeApiError', () => {
  it('replaces the developer-facing network error with plain language', () => {
    expect(
      describeApiError({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        status: null,
      }),
    ).toBe("Can't reach the server. Check your connection and try again.");
  });

  it('distinguishes a timeout from a dead connection', () => {
    expect(
      describeApiError({
        message: 'timeout of 15000ms exceeded',
        code: 'ECONNABORTED',
        status: null,
      }),
    ).toBe('The server took too long to respond. Please try again.');
  });

  it('tells the customer their session expired on a 401', () => {
    expect(
      describeApiError({
        message: 'unauthorized',
        code: 'ERR_BAD_REQUEST',
        status: 401,
      }),
    ).toBe('Your session has expired. Please sign in again.');
  });

  it('does not blame the customer for a 5xx', () => {
    expect(
      describeApiError({
        message: 'boom',
        code: 'ERR_BAD_RESPONSE',
        status: 503,
      }),
    ).toBe('The server is having trouble right now. Please try again shortly.');
  });

  it('passes a server-supplied client-error message straight through', () => {
    expect(
      describeApiError({
        message: 'KYC Verification is required for trades above 50,000 INR',
        code: 'ERR_BAD_REQUEST',
        status: 400,
      }),
    ).toBe('KYC Verification is required for trades above 50,000 INR');
  });

  it('still reads a genuine Error, and returns null for nothing useful', () => {
    expect(describeApiError(new Error('kaboom'))).toBe('kaboom');
    expect(describeApiError(undefined)).toBeNull();
  });
});
