import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';
import { useCancelRedemption } from './useCancelRedemption';
import { useCollectRedemption } from './useCollectRedemption';
import { usePendingRedemptions } from './usePendingRedemptions';

afterEach(() => {
  jest.restoreAllMocks();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const page = { items: [], page: 1, limit: 20, hasNextPage: false };
  const keys = {
    pending: adminQueryKeys.redemptionsPendingPage(1, 20, ''),
    searched: adminQueryKeys.redemptionsPendingPage(1, 20, '9876543210'),
    ledger: adminQueryKeys.ledgerPage(1, 20),
    customers: adminQueryKeys.customerPage(1, 20),
    analytics: adminQueryKeys.analytics,
    kyc: adminQueryKeys.kycPendingPage(1, 20),
  };
  Object.values(keys).forEach((key) => client.setQueryData(key, page));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const invalidated = (key: readonly unknown[]) =>
    client.getQueryState(key)?.isInvalidated;
  return { client, keys, wrapper, invalidated };
}

describe('usePendingRedemptions', () => {
  it('loads the requested page and phone filter under their own query key', async () => {
    const page = { items: [], page: 2, limit: 50, hasNextPage: false };
    const spy = jest
      .spyOn(adminService, 'getPendingRedemptions')
      .mockResolvedValue(page);
    const { client, wrapper } = setup();

    const { result, unmount } = renderHook(
      () => usePendingRedemptions(2, 50, '9123456789'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(page));
    expect(spy).toHaveBeenCalledWith(2, 50, '9123456789');
    expect(
      client.getQueryData(
        adminQueryKeys.redemptionsPendingPage(2, 50, '9123456789'),
      ),
    ).toEqual(page);
    unmount();
    client.clear();
  });
});

describe('useCollectRedemption', () => {
  it('refreshes every pending list and the ledger, but not customers', async () => {
    jest.spyOn(adminService, 'collectRedemption').mockResolvedValue(undefined);
    const { client, keys, wrapper, invalidated } = setup();
    const { result, unmount } = renderHook(() => useCollectRedemption(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        redemptionId: 'r1',
        pickupCode: '123456',
      });
    });

    expect(invalidated(keys.pending)).toBe(true);
    expect(invalidated(keys.searched)).toBe(true);
    expect(invalidated(keys.ledger)).toBe(true);
    expect(invalidated(keys.customers)).toBe(false);
    expect(invalidated(keys.kyc)).toBe(false);
    unmount();
    client.clear();
  });

  it('still refreshes the list when the request fails', async () => {
    jest
      .spyOn(adminService, 'collectRedemption')
      .mockRejectedValue({ status: 409, code: 'REDEMPTION_NOT_PENDING' });
    const { client, keys, wrapper, invalidated } = setup();
    const { result, unmount } = renderHook(() => useCollectRedemption(), {
      wrapper,
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ redemptionId: 'r1', pickupCode: '123456' }),
      ).rejects.toMatchObject({ status: 409 });
    });

    expect(invalidated(keys.pending)).toBe(true);
    unmount();
    client.clear();
  });
});

describe('useCancelRedemption', () => {
  it('refreshes pickups, ledger, customers and analytics because the gold returns to the vault', async () => {
    jest.spyOn(adminService, 'cancelRedemption').mockResolvedValue(undefined);
    const { client, keys, wrapper, invalidated } = setup();
    const { result, unmount } = renderHook(() => useCancelRedemption(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('r1');
    });

    expect(invalidated(keys.pending)).toBe(true);
    expect(invalidated(keys.ledger)).toBe(true);
    expect(invalidated(keys.customers)).toBe(true);
    expect(invalidated(keys.analytics)).toBe(true);
    expect(invalidated(keys.kyc)).toBe(false);
    unmount();
    client.clear();
  });

  it('still refreshes the list when the request fails', async () => {
    jest
      .spyOn(adminService, 'cancelRedemption')
      .mockRejectedValue({ status: 404, code: 'REDEMPTION_NOT_FOUND' });
    const { client, keys, wrapper, invalidated } = setup();
    const { result, unmount } = renderHook(() => useCancelRedemption(), {
      wrapper,
    });

    await act(async () => {
      await expect(result.current.mutateAsync('r1')).rejects.toMatchObject({
        status: 404,
      });
    });

    expect(invalidated(keys.pending)).toBe(true);
    unmount();
    client.clear();
  });
});
