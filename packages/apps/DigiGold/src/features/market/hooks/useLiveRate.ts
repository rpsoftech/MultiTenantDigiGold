import { useQuery } from '@tanstack/react-query';
import { marketService } from '../market.service';

const LIVE_RATE_REFRESH_MS = 30_000;

export function useLiveRate() {
  return useQuery({
    queryKey: ['market', 'live-rate'],
    queryFn: marketService.getLiveRate,
    refetchInterval: LIVE_RATE_REFRESH_MS,
  });
}
