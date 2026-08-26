import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { apiClient } from '../../lib/api/client';
import { authService } from './auth.service';

const testEnv = (
  globalThis as unknown as {
    process: { env: Record<string, string | undefined> };
  }
).process.env;

describe('authService', () => {
  const originalUseMockAuth = testEnv.NEXT_PUBLIC_USE_MOCK_AUTH;

  beforeEach(() => {
    testEnv.NEXT_PUBLIC_USE_MOCK_AUTH = 'false';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
    if (originalUseMockAuth === undefined) {
      delete testEnv.NEXT_PUBLIC_USE_MOCK_AUTH;
    } else {
      testEnv.NEXT_PUBLIC_USE_MOCK_AUTH = originalUseMockAuth;
    }
  });

  it('requests an OTP using the MainServer auth endpoint shape', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        success: true,
        message: 'OTP Dispatched Successfully',
        is_registered: false,
      },
    });

    const result = await authService.requestOtp({ mobileNumber: '9876543210' });

    expect(postSpy).toHaveBeenCalledWith('/auth/otp/request', {
      phone: '9876543210',
    });
    expect(result).toEqual({
      success: true,
      message: 'OTP Dispatched Successfully',
      is_registered: false,
    });
  });

  it('verifies an OTP and stores returned auth tokens', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        success: true,
        message: 'OTP Verified Successfully.',
        is_registered: true,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      },
    });

    const result = await authService.verifyOtp({
      mobileNumber: '9876543210',
      otp: '654321',
    });

    expect(postSpy).toHaveBeenCalledWith('/auth/otp/verify', {
      phone: '9876543210',
      otp: '654321',
    });
    expect(result.is_registered).toBe(true);
    expect(window.localStorage.getItem('access_token')).toBe('access-token');
    expect(window.localStorage.getItem('refresh_token')).toBe('refresh-token');
  });

  it('returns a registration token for unregistered users without storing auth tokens', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        success: true,
        message: 'OTP Verified Successfully. User not registered yet.',
        is_registered: false,
        registration_token: 'registration-token',
      },
    });

    const result = await authService.verifyOtp({
      mobileNumber: '1234567890',
      otp: '654321',
    });

    expect(result.registration_token).toBe('registration-token');
    expect(window.localStorage.getItem('access_token')).toBeNull();
    expect(window.localStorage.getItem('refresh_token')).toBeNull();
  });

  it('registers a user with the registration token and stores final auth tokens', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        success: true,
        message: 'Registered',
        is_registered: true,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      },
    });

    await authService.completeProfile({
      registrationToken: 'registration-token',
      fullName: 'Jane Doe',
      emailId: '',
    });

    expect(postSpy).toHaveBeenCalledWith('/auth/register', {
      registration_token: 'registration-token',
      full_name: 'Jane Doe',
      email_id: undefined,
    });
    expect(window.localStorage.getItem('access_token')).toBe(
      'new-access-token',
    );
    expect(window.localStorage.getItem('refresh_token')).toBe(
      'new-refresh-token',
    );
  });
});
