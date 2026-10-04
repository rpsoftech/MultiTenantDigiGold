import { useMutation } from '@tanstack/react-query';
import { redemptionService } from '../redemption.service';
import { useInvalidateRedemptionData } from './useInvalidateRedemptionData';

export function useCreateRedemption() {
  const invalidate = useInvalidateRedemptionData();

  return useMutation({
    mutationFn: redemptionService.create,
    onSuccess: () => invalidate(),
  });
}
