import { act } from '@testing-library/react';
import {
  makeJwt,
  renderHookWithProviders,
} from '@/test-utils/renderWithProviders';
import { setStoredKycStatus } from '@/features/kyc/kyc-status-storage';
import { getRegistrationToken } from '@/lib/auth/tokenStorage';
import { authService } from '../auth.service';
import { useCompleteProfile } from './useCompleteProfile';
import { useRequestOtp } from './useRequestOtp';
import { useVerifyOtp } from './useVerifyOtp';

jest.mock('../auth.service', () => ({
  authService: {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    completeProfile: jest.fn(),
  },
}));

const mockedAuth = authService as jest.Mocked<typeof authService>;

describe('useRequestOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests an OTP for the given number', async () => {
    mockedAuth.requestOtp.mockResolvedValue({
      success: true,
      message: 'sent',
      is_registered: true,
    });
    const { result } = renderHookWithProviders(() => useRequestOtp(), { user: null });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({ mobileNumber: '9876543210' });
    });

    expect(mockedAuth.requestOtp.mock.calls[0][0]).toEqual({ mobileNumber: '9876543210' });
    expect(response).toMatchObject({ is_registered: true });
  });

  it('surfaces a failure to the caller', async () => {
    mockedAuth.requestOtp.mockRejectedValue({ status: 429, message: 'wait' });
    const { result } = renderHookWithProviders(() => useRequestOtp(), { user: null });

    await act(async () => {
      await expect(result.current.mutateAsync({ mobileNumber: '9876543210' })).rejects.toMatchObject({
        status: 429,
      });
    });
  });
});

describe('useVerifyOtp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('signs a registered customer in using the user id from the access token', async () => {
    mockedAuth.verifyOtp.mockResolvedValue({
      success: true,
      message: 'ok',
      is_registered: true,
      access_token: makeJwt({ user_uuid: 'u-42' }),
    });
    const { result, store } = renderHookWithProviders(() => useVerifyOtp(), { user: null });

    await act(async () => {
      await result.current.mutateAsync({ mobileNumber: '9876543210', otp: '123456' });
    });

    expect(store.getState().session.user).toEqual({
      userId: 'u-42',
      role: 'customer',
      mobileNumber: '9876543210',
      isNewUser: false,
      kycStatus: 'not_started',
    });
    expect(store.getState().session.isAuthenticated).toBe(true);
  });

  it('restores the KYC status remembered for that customer', async () => {
    setStoredKycStatus('u-42', 'pending');
    mockedAuth.verifyOtp.mockResolvedValue({
      success: true,
      message: 'ok',
      is_registered: true,
      access_token: makeJwt({ user_uuid: 'u-42' }),
    });
    const { result, store } = renderHookWithProviders(() => useVerifyOtp(), { user: null });

    await act(async () => {
      await result.current.mutateAsync({ mobileNumber: '9876543210', otp: '123456' });
    });

    expect(store.getState().session.user?.kycStatus).toBe('pending');
  });

  it('starts registration for a new number and keeps the registration token', async () => {
    mockedAuth.verifyOtp.mockResolvedValue({
      success: true,
      message: 'ok',
      is_registered: false,
      registration_token: 'reg-token',
    });
    const { result, store } = renderHookWithProviders(() => useVerifyOtp(), { user: null });

    await act(async () => {
      await result.current.mutateAsync({ mobileNumber: '9876543210', otp: '123456' });
    });

    const session = store.getState().session;
    expect(session.registrationToken).toBe('reg-token');
    expect(session.registrationPhone).toBe('9876543210');
    expect(session.user?.isNewUser).toBe(true);
    expect(session.isAuthenticated).toBe(false);
    expect(getRegistrationToken()).toBe('reg-token');
  });

  it('changes nothing when the code is rejected', async () => {
    mockedAuth.verifyOtp.mockRejectedValue({ status: 400, message: 'bad otp' });
    const { result, store } = renderHookWithProviders(() => useVerifyOtp(), { user: null });

    await act(async () => {
      await result.current
        .mutateAsync({ mobileNumber: '9876543210', otp: '000000' })
        .catch(() => undefined);
    });

    expect(store.getState().session.user).toBeNull();
    expect(getRegistrationToken()).toBeNull();
  });
});

describe('useCompleteProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits the profile and marks the new customer as registered', async () => {
    mockedAuth.completeProfile.mockResolvedValue({
      success: true,
      message: 'ok',
      is_registered: true,
    });
    const { result, store } = renderHookWithProviders(() => useCompleteProfile(), {
      user: {
        userId: '',
        role: 'customer',
        mobileNumber: '9876543210',
        isNewUser: true,
        kycStatus: 'not_started',
      },
    });
    const payload = {
      registrationToken: 'reg',
      fullName: 'Jane Doe',
      location: 'India',
      emailId: '',
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockedAuth.completeProfile.mock.calls[0][0]).toEqual(payload);
    expect(store.getState().session.user?.isNewUser).toBe(false);
    expect(store.getState().session.isAuthenticated).toBe(true);
  });

  it('leaves the registration state alone when the request fails', async () => {
    mockedAuth.completeProfile.mockRejectedValue({ status: 500, message: 'down' });
    const { result, store } = renderHookWithProviders(() => useCompleteProfile(), {
      user: {
        userId: '',
        role: 'customer',
        mobileNumber: '9876543210',
        isNewUser: true,
        kycStatus: 'not_started',
      },
    });

    await act(async () => {
      await result.current
        .mutateAsync({ registrationToken: 'reg', fullName: 'Jane', location: 'India' })
        .catch(() => undefined);
    });

    expect(store.getState().session.user?.isNewUser).toBe(true);
  });
});
