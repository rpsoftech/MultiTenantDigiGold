import { apiClient } from '@/lib/api/client';
import type { KycStatusResult, SubmitKycPayload, SubmitKycResult } from './kyc.types';

export const kycService = {
  getStatus: async (): Promise<KycStatusResult> => {
    const response = await apiClient.get<KycStatusResult>('/user/kyc');
    return response.data;
  },

  submitKyc: async (payload: SubmitKycPayload): Promise<SubmitKycResult> => {
    const response = await apiClient.post<SubmitKycResult>('/user/kyc', payload);
    return response.data;
  },
};
