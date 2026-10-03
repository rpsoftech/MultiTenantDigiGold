import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { makeJwt } from '@/test-utils/renderWithProviders';
import { getAccessToken, setTokens } from '@/lib/auth/tokenStorage';
import { onSessionExpired } from '@/lib/auth/sessionEvents';
import { apiClient } from './client';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 3600;

let lastConfig: InternalAxiosRequestConfig | undefined;

// Replaces the network layer so the interceptors run exactly as in production.
function respondWith(status: number, data: unknown = {}) {
  apiClient.defaults.adapter = async (config) => {
    lastConfig = config;
    const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
    if (status >= 400) {
      throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
    }
    return response;
  };
}

const sentHeader = (name: string) => lastConfig?.headers.get(name);

describe('apiClient interceptors', () => {
  const originalAdapter = apiClient.defaults.adapter;
  const originalTenant = process.env.NEXT_PUBLIC_TENANT_UUID;
  let expired: jest.Mock;
  let unsubscribe: () => void;

  beforeEach(() => {
    window.localStorage.clear();
    lastConfig = undefined;
    process.env.NEXT_PUBLIC_TENANT_UUID = 'tenant-123';
    expired = jest.fn();
    unsubscribe = onSessionExpired(expired);
  });

  afterEach(() => {
    unsubscribe();
    apiClient.defaults.adapter = originalAdapter;
    if (originalTenant === undefined) delete process.env.NEXT_PUBLIC_TENANT_UUID;
    else process.env.NEXT_PUBLIC_TENANT_UUID = originalTenant;
  });

  describe('requests', () => {
    it('sends the tenant id on every request', async () => {
      respondWith(200);

      await apiClient.get('/tenant/info');

      expect(sentHeader('X-Tenant-ID')).toBe('tenant-123');
    });

    it('omits the tenant header when no tenant is configured', async () => {
      delete process.env.NEXT_PUBLIC_TENANT_UUID;
      respondWith(200);

      await apiClient.get('/tenant/info');

      expect(sentHeader('X-Tenant-ID')).toBeUndefined();
    });

    it('sends a usable access token on protected endpoints', async () => {
      const token = makeJwt({ user_uuid: 'u-1', exp: FUTURE });
      setTokens({ accessToken: token });
      respondWith(200);

      await apiClient.get('/user/portfolio');

      expect(sentHeader('X-Api-Token')).toBe(token);
    });

    it.each(['/auth/otp/request', '/auth/otp/verify', '/admin/auth/login'])(
      'never attaches the token to the public endpoint %s',
      async (url) => {
        setTokens({ accessToken: makeJwt({ exp: FUTURE }) });
        respondWith(200);

        await apiClient.post(url, {});

        expect(sentHeader('X-Api-Token')).toBeUndefined();
      },
    );

    it('sends no token when logged out', async () => {
      respondWith(200);

      await apiClient.get('/user/portfolio');

      expect(sentHeader('X-Api-Token')).toBeUndefined();
      expect(expired).not.toHaveBeenCalled();
    });

    it('drops an expired token and signals that the session ended', async () => {
      setTokens({ accessToken: makeJwt({ exp: PAST }) });
      respondWith(200);

      await apiClient.get('/user/portfolio');

      expect(sentHeader('X-Api-Token')).toBeUndefined();
      expect(getAccessToken()).toBeNull();
      expect(expired).toHaveBeenCalledTimes(1);
    });
  });

  describe('responses', () => {
    it('clears the session when a protected request is rejected with 401', async () => {
      setTokens({ accessToken: makeJwt({ exp: FUTURE }) });
      respondWith(401, { message: 'Unauthorized', name: 'UNAUTHORIZED' });

      await expect(apiClient.get('/user/portfolio')).rejects.toMatchObject({ status: 401 });

      expect(getAccessToken()).toBeNull();
      expect(expired).toHaveBeenCalledTimes(1);
    });

    it('does not treat a 401 from a public auth endpoint as an expired session', async () => {
      setTokens({ accessToken: makeJwt({ exp: FUTURE }) });
      respondWith(401, { message: 'Invalid OTP', name: 'INVALID_OTP' });

      await expect(apiClient.post('/auth/otp/verify', {})).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_OTP',
      });

      expect(getAccessToken()).not.toBeNull();
      expect(expired).not.toHaveBeenCalled();
    });

    it('does not sign the user out for other error statuses', async () => {
      setTokens({ accessToken: makeJwt({ exp: FUTURE }) });
      respondWith(500, { message: 'Boom' });

      await expect(apiClient.get('/user/portfolio')).rejects.toMatchObject({ status: 500 });

      expect(expired).not.toHaveBeenCalled();
    });

    it('normalizes the MainServer error body', async () => {
      respondWith(429, { message: 'Please wait 30 seconds', name: 'ERROR_RECENT_OTP_REQ_EXIST' });

      await expect(apiClient.get('/x')).rejects.toEqual({
        message: 'Please wait 30 seconds',
        code: 'ERROR_RECENT_OTP_REQ_EXIST',
        status: 429,
      });
    });

    it('falls back to the transport error when the body has no message', async () => {
      respondWith(502, 'Bad gateway');

      await expect(apiClient.get('/x')).rejects.toEqual({
        message: 'Request failed',
        code: 'ERR_BAD_REQUEST',
        status: 502,
      });
    });

    it('reports a null status when there was no response at all', async () => {
      apiClient.defaults.adapter = async (config) => {
        throw new AxiosError('Network Error', 'ERR_NETWORK', config);
      };

      await expect(apiClient.get('/x')).rejects.toEqual({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        status: null,
      });
    });

    it('passes successful responses through untouched', async () => {
      respondWith(200, { ok: true });

      const response = await apiClient.get('/x');

      expect(response.data).toEqual({ ok: true });
    });
  });
});
