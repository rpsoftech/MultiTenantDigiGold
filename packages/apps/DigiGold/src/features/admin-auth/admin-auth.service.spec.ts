import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  clearAdminTokens,
  getAdminAccessToken,
  getAdminRefreshToken,
  storeAdminTokens,
} from '@/lib/api/admin-tokens';
import { apiClient } from '@/lib/api/client';

import { adminAuthService } from './admin-auth.service';

describe('adminAuthService', () => {
  const originalMockSetting = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH;
  const credentials = { username: 'demo-manager', password: 'password' };
  const challenge = { temp_token: 'temporary-login-token' };
  const enrollment = {
    otpauth_uri:
      'otpauth://totp/DigiGold:demo-manager?secret=EXAMPLE&issuer=DigiGold',
  };
  const tokens = {
    access_token: 'admin-access',
    refresh_token: 'admin-refresh',
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH;
    window.localStorage.clear();
    clearAdminTokens();
    window.localStorage.setItem('access_token', 'customer-access');
    window.localStorage.setItem('refresh_token', 'customer-refresh');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearAdminTokens();
    window.localStorage.clear();
    if (originalMockSetting === undefined) {
      delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH;
    } else {
      process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH = originalMockSetting;
    }
  });

  function expectCustomerTokensUnchanged() {
    expect(window.localStorage.getItem('access_token')).toBe('customer-access');
    expect(window.localStorage.getItem('refresh_token')).toBe(
      'customer-refresh',
    );
  }

  function expectNoAdminSession() {
    expect(getAdminAccessToken()).toBeNull();
    expect(getAdminRefreshToken()).toBeNull();
    expectCustomerTokensUnchanged();
  }

  it('uses the real username/password endpoint by default and returns only a temporary challenge', async () => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: challenge });

    await expect(adminAuthService.login(credentials)).resolves.toEqual(
      challenge,
    );

    expect(post).toHaveBeenCalledWith('/admin/auth/login', credentials);
    expectNoAdminSession();
    expect(window.localStorage.getItem('temp_token')).toBeNull();
  });

  it('rejects a login response without a temporary token', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });

    await expect(adminAuthService.login(credentials)).rejects.toThrow(
      'The server did not return a temporary login token.',
    );
    expectNoAdminSession();
  });

  it('posts the temporary challenge for setup and returns the raw enrollment URI', async () => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: enrollment });

    await expect(adminAuthService.setupTotp(challenge)).resolves.toEqual(
      enrollment,
    );

    expect(post).toHaveBeenCalledWith('/admin/auth/totp/setup', challenge);
    expectNoAdminSession();
  });

  it('maps only the ADMIN_TOTP_ALREADY_ENABLED response to the existing-authenticator flow', async () => {
    jest.spyOn(apiClient, 'post').mockRejectedValue({
      status: 409,
      message: 'TOTP is already enabled for this admin',
      code: 'ADMIN_TOTP_ALREADY_ENABLED',
    });

    await expect(adminAuthService.setupTotp(challenge)).resolves.toBeNull();
    expectNoAdminSession();
  });

  it.each([
    {
      status: 401,
      message: 'Your sign-in has expired. Please enter your password again.',
      code: 'ADMIN_TEMP_TOKEN_INVALID',
    },
    // The pre-name response shape: matching on message text is exactly what was removed.
    {
      status: 400,
      message: 'TOTP is already enabled for this admin',
      code: 'ERR_BAD_REQUEST',
    },
    {
      status: 401,
      message: 'TOTP is already enabled for this admin',
      code: 'ERR_BAD_REQUEST',
    },
    {
      status: 500,
      message: 'TOTP is already enabled for this admin',
      code: 'ERR_BAD_RESPONSE',
    },
    { status: null, message: 'Network Error', code: 'ERR_NETWORK' },
  ])('preserves setup failure $status: $message', async (error) => {
    jest.spyOn(apiClient, 'post').mockRejectedValue(error);

    await expect(adminAuthService.setupTotp(challenge)).rejects.toBe(error);
    expectNoAdminSession();
  });

  it('rejects an incomplete enrollment response', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });

    await expect(adminAuthService.setupTotp(challenge)).rejects.toThrow(
      'The server did not return an authenticator enrollment URI.',
    );
    expectNoAdminSession();
  });

  it('stores the raw token pair only after successful TOTP verification', async () => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: tokens });
    const payload = { ...challenge, code: '123456' };

    await expect(adminAuthService.verifyTotp(payload)).resolves.toEqual(tokens);

    expect(post).toHaveBeenCalledWith('/admin/auth/totp/verify', payload);
    expect(getAdminAccessToken()).toBe('admin-access');
    expect(getAdminRefreshToken()).toBe('admin-refresh');
    expectCustomerTokensUnchanged();
  });

  it('does not store a session when the authenticator code is rejected', async () => {
    const error = {
      status: 401,
      message: 'invalid TOTP code',
      code: 'ERR_BAD_REQUEST',
    };
    jest.spyOn(apiClient, 'post').mockRejectedValue(error);

    await expect(
      adminAuthService.verifyTotp({ ...challenge, code: '000000' }),
    ).rejects.toBe(error);
    expectNoAdminSession();
  });

  it.each([
    undefined,
    {},
    { access_token: 'admin-access' },
    { access_token: '', refresh_token: 'admin-refresh' },
    { access_token: 'admin-access', refresh_token: '' },
    { access_token: 123, refresh_token: 'admin-refresh' },
  ])('does not store malformed verification tokens: %j', async (data) => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({ data });

    await expect(
      adminAuthService.verifyTotp({ ...challenge, code: '123456' }),
    ).rejects.toThrow('The server did not return valid admin tokens.');
    expectNoAdminSession();
  });

  it('delegates refresh to the real token refresh path and stores rotation', async () => {
    storeAdminTokens(tokens);
    const rotated = {
      access_token: 'rotated-admin-access',
      refresh_token: 'rotated-admin-refresh',
    };
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: rotated });

    await expect(adminAuthService.refresh()).resolves.toEqual(rotated);

    expect(post).toHaveBeenCalledWith('/admin/auth/refresh', {
      refresh_token: 'admin-refresh',
    });
    expect(getAdminAccessToken()).toBe('rotated-admin-access');
    expect(getAdminRefreshToken()).toBe('rotated-admin-refresh');
    expectCustomerTokensUnchanged();
  });

  it('keeps the full first-login and returning-admin TOTP flow in explicitly enabled mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH = 'true';
    const post = jest.spyOn(apiClient, 'post');
    const mockCredentials = {
      username: `mock-manager-${crypto.randomUUID()}`,
      password: 'demo-password',
    };

    const firstLogin = await adminAuthService.login(mockCredentials);
    expect(firstLogin.temp_token).toBeTruthy();
    expect(firstLogin.totp_enabled).toBe(false);
    expectNoAdminSession();
    await expect(
      adminAuthService.verifyTotp({ ...firstLogin, code: '123456' }),
    ).rejects.toMatchObject({ code: 'ADMIN_TOTP_NOT_SET_UP', status: 400 });

    const firstSetup = await adminAuthService.setupTotp(firstLogin);
    expect(firstSetup?.otpauth_uri).toContain('otpauth://totp/');
    expect(firstSetup?.otpauth_uri).toContain(mockCredentials.username);
    await expect(
      adminAuthService.verifyTotp({ ...firstLogin, code: '000000' }),
    ).rejects.toMatchObject({ code: 'ADMIN_TOTP_CODE_INVALID', status: 401 });
    expectNoAdminSession();

    const firstTokens = await adminAuthService.verifyTotp({
      ...firstLogin,
      code: '123456',
    });
    expect(getAdminAccessToken()).toBe(firstTokens.access_token);
    expect(getAdminRefreshToken()).toBe(firstTokens.refresh_token);
    await expect(
      adminAuthService.verifyTotp({ ...firstLogin, code: '123456' }),
    ).rejects.toMatchObject({ code: 'ADMIN_TEMP_TOKEN_INVALID', status: 401 });

    clearAdminTokens();
    const returningLogin = await adminAuthService.login(mockCredentials);
    expect(returningLogin.totp_enabled).toBe(true);
    await expect(
      adminAuthService.setupTotp(returningLogin),
    ).resolves.toBeNull();
    expectNoAdminSession();
    const returningTokens = await adminAuthService.verifyTotp({
      ...returningLogin,
      code: '123456',
    });
    expect(getAdminRefreshToken()).toBe(returningTokens.refresh_token);

    const refreshedTokens = await adminAuthService.refresh();
    expect(refreshedTokens.refresh_token).not.toBe(
      returningTokens.refresh_token,
    );
    expect(getAdminRefreshToken()).toBe(refreshedTokens.refresh_token);
    expectCustomerTokensUnchanged();
    expect(post).not.toHaveBeenCalled();
  });
});
