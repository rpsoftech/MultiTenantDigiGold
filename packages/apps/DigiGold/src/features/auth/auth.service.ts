import { apiClient } from '@/lib/api/client';
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
    if (response.data.access_token) {
      window.localStorage.setItem('access_token', response.data.access_token);
    }
    if (response.data.refresh_token) {
      window.localStorage.setItem('refresh_token', response.data.refresh_token);
    }
    return response.data;
  },

  completeProfile: async (
    payload: CompleteProfilePayload,
  ): Promise<VerifyOtpResult> => {
    if (shouldUseMockAuth()) return mockCompleteProfile(payload);
    const response = await apiClient.post<VerifyOtpResult>('/auth/register', {
      registration_token: payload.registrationToken,
      full_name: payload.fullName,
      email_id: payload.emailId || undefined,
    });
    if (response.data.access_token) {
      window.localStorage.setItem('access_token', response.data.access_token);
    }
    if (response.data.refresh_token) {
      window.localStorage.setItem('refresh_token', response.data.refresh_token);
    }
    return response.data;
  },
};
