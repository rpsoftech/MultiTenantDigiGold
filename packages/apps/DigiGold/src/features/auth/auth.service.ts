import { apiClient } from '@/lib/api/client';
import { getRefreshToken, setTokens } from '@/lib/auth/tokenStorage';
import type {
  RequestOtpPayload,
  RequestOtpResult,
  VerifyOtpPayload,
  VerifyOtpResult,
  CompleteProfilePayload,
} from './auth.types';
import {
  mockRequestOtp,
  mockVerifyOtp,
  mockCompleteProfile,
} from './auth.mock';

export function shouldUseMockAuth() {
  return process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';
}

export const authService = {
  requestOtp: async (payload: RequestOtpPayload): Promise<RequestOtpResult> => {
    if (shouldUseMockAuth()) return mockRequestOtp(payload);
    const response = await apiClient.post<RequestOtpResult>(
      '/auth/otp/request',
      {
        phone: payload.mobileNumber,
      },
    );
    return response.data;
  },

  verifyOtp: async (payload: VerifyOtpPayload): Promise<VerifyOtpResult> => {
    if (shouldUseMockAuth()) return mockVerifyOtp(payload);
    const response = await apiClient.post<VerifyOtpResult>('/auth/otp/verify', {
      phone: payload.mobileNumber,
      otp: payload.otp,
    });
    setTokens({
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    });
    return response.data;
  },

  completeProfile: async (
    payload: CompleteProfilePayload,
  ): Promise<VerifyOtpResult> => {
    if (shouldUseMockAuth()) {
      const result = await mockCompleteProfile(payload);
      setTokens({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
      });
      return result;
    }
    const response = await apiClient.post<VerifyOtpResult>('/auth/register', {
      registration_token: payload.registrationToken,
      full_name: payload.fullName,
      location: payload.location,
      email_id: payload.emailId || undefined,
    });
    setTokens({
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    });
    return response.data;
  },

  // Revokes the stored refresh token on MainServer so a copy of it stops working once the
  // customer signs out. Best effort: signing out locally must not wait for (or fail on) it.
  logout: async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken || shouldUseMockAuth()) return;
    try {
      await apiClient.post('/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Already expired or revoked, or offline: the local session ends either way.
    }
  },
};
