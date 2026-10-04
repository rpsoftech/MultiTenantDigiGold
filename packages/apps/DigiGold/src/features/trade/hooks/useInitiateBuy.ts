import { useMutation } from '@tanstack/react-query';
import { tradeService } from '../trade.service';

export function useInitiateBuy() {
  return useMutation({ mutationFn: tradeService.initiateBuy });
}
