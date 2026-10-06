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

describe('useUpdateKycStatus', () => {
  it('invalidates directory pages and recent customers after a review, leaving ledger data cached', async () => {
    jest.spyOn(adminService, 'updateKycStatus').mockResolvedValue(undefined);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const directoryKey = adminQueryKeys.customerPage(2, 20);
    const recentKey = adminQueryKeys.customerPage(1, 5);
    const ledgerKey = adminQueryKeys.ledgerPage(1, 20);
    const page = { items: [], page: 1, limit: 20, hasNextPage: false };
    client.setQueryData(directoryKey, page);
    client.setQueryData(recentKey, page);
    client.setQueryData(ledgerKey, page);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useUpdateKycStatus(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        userId: 'customer-uuid',
        kycStatus: 'verified',
      });
    });

    expect(client.getQueryState(directoryKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(recentKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(ledgerKey)?.isInvalidated).toBe(false);
    unmount();
    client.clear();
  });
});
