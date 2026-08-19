import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type {
  RequestOtpPayload,
  RequestOtpResult,
  VerifyOtpPayload,
  VerifyOtpResult,
  CompleteProfilePayload,
} from './auth.types';
import { mockRequestOtp, mockVerifyOtp, mockCompleteProfile } from './auth.mock';

const USE_MOCK_AUTH = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';

export const authService = {
  requestOtp: async (payload: RequestOtpPayload): Promise<RequestOtpResult> => {
    if (USE_MOCK_AUTH) return mockRequestOtp(payload);
    const response = await apiClient.post<ApiResponse<RequestOtpResult>>(
      '/auth/request-otp',
      payload
    );
    return response.data.data;
  },

  verifyOtp: async (payload: VerifyOtpPayload): Promise<VerifyOtpResult> => {
    if (USE_MOCK_AUTH) return mockVerifyOtp(payload);
    const response = await apiClient.post<ApiResponse<VerifyOtpResult>>(
      '/auth/verify-otp',
      payload
    );
    return response.data.data;
  },

  completeProfile: async (payload: CompleteProfilePayload): Promise<void> => {
    if (USE_MOCK_AUTH) return mockCompleteProfile(payload);
    await apiClient.post<ApiResponse<null>>('/auth/complete-profile', payload);
  },
};
