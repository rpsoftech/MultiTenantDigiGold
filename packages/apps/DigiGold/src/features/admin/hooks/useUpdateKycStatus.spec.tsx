import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';
import { useUpdateKycStatus } from './useUpdateKycStatus';

afterEach(() => {
  jest.restoreAllMocks();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const page = { items: [], page: 1, limit: 20, hasNextPage: false };
  const keys = {
    directory: adminQueryKeys.customerPage(2, 20),
    recent: adminQueryKeys.customerPage(1, 5),
    queue: adminQueryKeys.kycPendingPage(1, 20),
    ledger: adminQueryKeys.ledgerPage(1, 20),
  };
  Object.values(keys).forEach((key) => client.setQueryData(key, page));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useUpdateKycStatus(), { wrapper });
  const invalidated = (key: readonly unknown[]) =>
    client.getQueryState(key)?.isInvalidated;
  return { client, keys, hook, invalidated };
}

describe('useUpdateKycStatus', () => {
  it('invalidates the review queue, directory pages and recent customers after a review, leaving ledger data cached', async () => {
    jest.spyOn(adminService, 'updateKycStatus').mockResolvedValue(undefined);
    const { client, keys, hook, invalidated } = setup();

    await act(async () => {
      await hook.result.current.mutateAsync({
        userId: 'customer-uuid',
        kycStatus: 'verified',
      });
    });

    expect(invalidated(keys.queue)).toBe(true);
    expect(invalidated(keys.directory)).toBe(true);
    expect(invalidated(keys.recent)).toBe(true);
    expect(invalidated(keys.ledger)).toBe(false);
    hook.unmount();
    client.clear();
  });

  it('still refreshes the queue when the decision fails, since the queue is then stale', async () => {
    jest
      .spyOn(adminService, 'updateKycStatus')
      .mockRejectedValue({ status: 403, message: 'user not found in tenant' });
    const { client, keys, hook, invalidated } = setup();

    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({
          userId: 'customer-uuid',
          kycStatus: 'rejected',
        }),
      ).rejects.toMatchObject({ status: 403 });
    });

    expect(invalidated(keys.queue)).toBe(true);
    expect(invalidated(keys.directory)).toBe(true);
    hook.unmount();
    client.clear();
  });
});
