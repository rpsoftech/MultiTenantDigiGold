import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';
import { useReverseLedgerEntry } from './useReverseLedgerEntry';

afterEach(() => {
  jest.restoreAllMocks();
});

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
  const hook = renderHook(() => useReverseLedgerEntry(), { wrapper });
  return { client, keys, hook };
}

describe('useReverseLedgerEntry', () => {
  it('refreshes the ledger, customers and analytics after a reversal', async () => {
    const reverse = jest
      .spyOn(adminService, 'reverseLedgerEntry')
      .mockResolvedValue(undefined);
    const { client, keys, hook } = setup();

    await act(async () => {
      await hook.result.current.mutateAsync('ledger-uuid');
    });

    expect(reverse.mock.calls[0][0]).toBe('ledger-uuid');
    expect(client.getQueryState(keys.ledger)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.customers)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.analytics)?.isInvalidated).toBe(true);
    hook.unmount();
    client.clear();
  });

  it('still refreshes the ledger when the server rejects the reversal', async () => {
    jest
      .spyOn(adminService, 'reverseLedgerEntry')
      .mockRejectedValue({ status: 409, code: 'CONFLICT', message: 'x' });
    const { client, keys, hook } = setup();

    await act(async () => {
      await hook.result.current
        .mutateAsync('ledger-uuid')
        .catch(() => undefined);
    });

    expect(client.getQueryState(keys.ledger)?.isInvalidated).toBe(true);
    hook.unmount();
    client.clear();
  });
});
