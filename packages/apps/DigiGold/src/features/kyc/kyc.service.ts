import { apiClient } from '@/lib/api/client';
import type { SubmitKycPayload, SubmitKycResult } from './kyc.types';

export const kycService = {
  submitKyc: async (payload: SubmitKycPayload): Promise<SubmitKycResult> => {
    const response = await apiClient.post<SubmitKycResult>('/user/kyc', payload);
    return response.data;
  },
};
