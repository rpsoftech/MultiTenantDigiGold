import { useMutation } from '@tanstack/react-query';
import { redemptionService } from '../redemption.service';
import { useInvalidateRedemptionData } from './useInvalidateRedemptionData';

export function useCancelRedemption() {
  const invalidate = useInvalidateRedemptionData();

  return useMutation({
    mutationFn: redemptionService.cancel,
    // A 409 (already collected or cancelled) means the list is stale, so refresh on error too.
    onSettled: () => invalidate(),
  });
}
