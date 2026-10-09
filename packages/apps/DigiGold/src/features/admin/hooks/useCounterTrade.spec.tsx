import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';
import { useCounterTrade } from './useCounterTrade';

afterEach(() => {
  jest.restoreAllMocks();
});

const payload = {
  userId: 'customer-uuid',
  ratePerGram: 7500,
  amountInr: 1000,
  paymentMode: 'COUNTER_CASH' as const,
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const page = { items: [], page: 1, limit: 20, hasNextPage: false };
  const keys = {
    ledger: adminQueryKeys.ledgerPage(1, 20),
    customers: adminQueryKeys.customerPage(1, 20),
    analytics: adminQueryKeys.analytics,
  };
  Object.values(keys).forEach((key) => client.setQueryData(key, page));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useCounterTrade(), { wrapper });
  return { client, keys, hook };
}

describe('useCounterTrade', () => {
  it('refreshes the ledger, customers and analytics after a sale', async () => {
    const create = jest
      .spyOn(adminService, 'createCounterTrade')
      .mockResolvedValue({ id: 'gl-1' } as never);
    const { client, keys, hook } = setup();

    await act(async () => {
      await hook.result.current.mutateAsync(payload);
    });

    expect(create.mock.calls[0][0]).toEqual(payload);
    expect(client.getQueryState(keys.ledger)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.customers)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.analytics)?.isInvalidated).toBe(true);
    hook.unmount();
    client.clear();
  });

  it('still refreshes when the server rejects the sale', async () => {
    jest
      .spyOn(adminService, 'createCounterTrade')
      .mockRejectedValue({ status: 409, code: 'SLIPPAGE_EXCEEDED', message: 'x' });
    const { client, keys, hook } = setup();

    await act(async () => {
      await hook.result.current.mutateAsync(payload).catch(() => undefined);
    });

    expect(client.getQueryState(keys.ledger)?.isInvalidated).toBe(true);
    hook.unmount();
    client.clear();
  });
});
