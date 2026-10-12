import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tradeService } from '../trade.service';
import type { TradeHistoryEntry } from '../trade.types';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 40000;

export type BuySettlementStatus = 'idle' | 'polling' | 'settled' | 'timeout';

// After Razorpay Checkout's handler fires, gold is credited asynchronously by the
// payment.captured webhook — not by this request. This hook polls GET /trade/history
// looking for the ledger entry the webhook writes (reference_id === the Razorpay payment
// id) so the UI can move from "payment received" to "gold credited".
export function useBuySettlement(paymentId: string | null) {
  const pollStartedAtRef = useRef<number | null>(null);
  if (paymentId !== null && pollStartedAtRef.current === null) {
    pollStartedAtRef.current = Date.now();
  } else if (paymentId === null) {
    pollStartedAtRef.current = null;
  }

  const query = useQuery({
    queryKey: ['trade', 'history', 'settlement-check', paymentId],
    queryFn: () => tradeService.getHistory({ page: 1, limit: 10 }),
    enabled: paymentId !== null,
    refetchInterval: (latestQuery) => {
      const entry = findEntry(latestQuery.state.data?.data, paymentId);
      const startedAt = pollStartedAtRef.current;
      if (entry || startedAt === null) return false;
      return Date.now() - startedAt >= MAX_POLL_DURATION_MS ? false : POLL_INTERVAL_MS;
    },
  });

  const entry = findEntry(query.data?.data, paymentId);
  const startedAt = pollStartedAtRef.current;
  const timedOut = startedAt !== null && Date.now() - startedAt >= MAX_POLL_DURATION_MS;

  let status: BuySettlementStatus = 'idle';
  if (paymentId !== null) {
    if (entry) status = 'settled';
    else if (timedOut) status = 'timeout';
    else status = 'polling';
  }

  // The timeout is a wall-clock deadline, not a query event — without an explicit
  // re-render trigger the hook would never notice it once refetchInterval stops itself.
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (status !== 'polling') return;
    const remainingMs = MAX_POLL_DURATION_MS - (Date.now() - (pollStartedAtRef.current ?? 0));
    const timeoutId = setTimeout(() => forceRender((tick) => tick + 1), Math.max(0, remainingMs));
    return () => clearTimeout(timeoutId);
  }, [status]);

  return { status, entry };
}

function findEntry(
  entries: TradeHistoryEntry[] | null | undefined,
  paymentId: string | null,
): TradeHistoryEntry | undefined {
  if (!entries || !paymentId) return undefined;
  return entries.find((entry) => entry.reference_id === paymentId);
}
