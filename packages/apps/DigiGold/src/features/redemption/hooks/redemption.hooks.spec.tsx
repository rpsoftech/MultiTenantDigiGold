import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import { redemptionService } from '../redemption.service';
import type { Redemption } from '../redemption.types';
import { useCancelRedemption } from './useCancelRedemption';
import { useCreateRedemption } from './useCreateRedemption';
import { useRedemptions } from './useRedemptions';

jest.mock('../redemption.service', () => ({
  redemptionService: { create: jest.fn(), list: jest.fn(), cancel: jest.fn() },
}));

const mockedService = redemptionService as jest.Mocked<typeof redemptionService>;

function makeRedemption(index: number): Redemption {
  return {
    redemption_uuid: `r-${index}`,
    weight_grams: 1,
    status: 'PENDING',
    pickup_code: '123456',
    created_at: '2026-10-01T10:00:00Z',
  };
}

function makePage(count: number, page: number) {
  return {
    success: true,
    data: Array.from({ length: count }, (_, index) => makeRedemption(page * 100 + index)),
    page,
    limit: 20,
  };
}

describe('useRedemptions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('flattens pages and offers the next page while pages are full', async () => {
    mockedService.list.mockResolvedValueOnce(makePage(20, 1));
    const { result } = renderHookWithProviders(() => useRedemptions());

    await waitFor(() => expect(result.current.redemptions).toHaveLength(20));
    expect(mockedService.list).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.current.hasNextPage).toBe(true);

    mockedService.list.mockResolvedValueOnce(makePage(3, 2));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockedService.list).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
    await waitFor(() => expect(result.current.redemptions).toHaveLength(23));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('has no next page when the first page is short', async () => {
    mockedService.list.mockResolvedValueOnce(makePage(2, 1));
    const { result } = renderHookWithProviders(() => useRedemptions());

    await waitFor(() => expect(result.current.redemptions).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('returns an empty list when there are no redemptions', async () => {
    mockedService.list.mockResolvedValueOnce(makePage(0, 1));
    const { result } = renderHookWithProviders(() => useRedemptions());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.redemptions).toEqual([]);
  });
});

describe('useCreateRedemption', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the redemption and refreshes redemptions, portfolio and the passbook', async () => {
    mockedService.create.mockResolvedValue({
      success: true,
      redemption: makeRedemption(1),
      message: 'ok',
    });
    const { result, queryClient } = renderHookWithProviders(() => useCreateRedemption());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({ weight_grams: 2 });
    });

    expect(mockedService.create.mock.calls[0][0]).toEqual({ weight_grams: 2 });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([['redemptions'], ['user', 'portfolio'], ['trade', 'history']]),
    );
  });

  it('does not refresh anything when creation fails', async () => {
    mockedService.create.mockRejectedValue({ message: 'Insufficient', status: 400 });
    const { result, queryClient } = renderHookWithProviders(() => useCreateRedemption());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({ weight_grams: 2 }).catch(() => undefined);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useCancelRedemption', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancels by uuid and refreshes related data', async () => {
    mockedService.cancel.mockResolvedValue({ success: true, message: 'ok' });
    const { result, queryClient } = renderHookWithProviders(() => useCancelRedemption());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync('r-1');
    });

    expect(mockedService.cancel.mock.calls[0][0]).toBe('r-1');
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('refreshes even when the server rejects, because the list is then stale', async () => {
    mockedService.cancel.mockRejectedValue({ code: 'REDEMPTION_NOT_PENDING', status: 409 });
    const { result, queryClient } = renderHookWithProviders(() => useCancelRedemption());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync('r-1').catch(() => undefined);
    });

    expect(invalidate).toHaveBeenCalledTimes(3);
  });
});
