import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isNormalizedApiError } from '@/lib/api/client';
import { kycService } from '../kyc.service';
import type { KycStatusResult } from '../kyc.types';
import { KYC_STATUS_QUERY_KEY } from './useKycStatus';

export function useSubmitKyc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: kycService.submitKyc,
    // A successful submit always moves the customer to pending server-side.
    onSuccess: () => {
      queryClient.setQueryData<KycStatusResult>(KYC_STATUS_QUERY_KEY, {
        success: true,
        kyc_status: 'pending',
      });
    },
    // 409 means this screen's status was stale (e.g. approved or submitted elsewhere);
    // refetch so the page shows the real state instead of the form.
    onError: (error) => {
      if (isNormalizedApiError(error) && error.code === 'KYC_NOT_SUBMITTABLE') {
        void queryClient.invalidateQueries({ queryKey: KYC_STATUS_QUERY_KEY });
      }
    },
  });
}
