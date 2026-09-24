import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { marketService } from '../market.service';
import { subscribeToLiveRate } from '../market.sse';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  rateReceived,
  statusChanged,
  selectMarketRate,
  selectMarketStatus,
} from '@/store/market/market.slice';

export function useLiveRate() {
  const dispatch = useAppDispatch();
  const rate = useAppSelector(selectMarketRate);
  const status = useAppSelector(selectMarketStatus);

  // One-shot hydration so there's a price to render before the stream's first tick lands;
  // once the store has a rate, live ticks from the stream take over.
  const { data: fetchedRate, isLoading } = useQuery({
    queryKey: ['market', 'last-rate'],
    queryFn: marketService.getLastRate,
    staleTime: Infinity,
    enabled: rate === null,
  });

  useEffect(() => {
    if (fetchedRate) dispatch(rateReceived(fetchedRate));
  }, [fetchedRate, dispatch]);

  // Subscribes to the shared live-rate stream; connection lifecycle itself is owned by
  // market.sse.ts (ref-counted singleton), not by this hook or component.
  useEffect(() => {
    const unsubscribe = subscribeToLiveRate({
      onTick: (nextRate) => dispatch(rateReceived(nextRate)),
      onStatusChange: (nextStatus) => dispatch(statusChanged(nextStatus)),
    });
    return unsubscribe;
  }, [dispatch]);

  return {
    data: rate,
    isLoading: rate === null && isLoading,
    isConnected: status === 'open',
    status,
  };
}
