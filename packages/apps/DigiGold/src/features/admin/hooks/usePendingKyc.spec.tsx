import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';
import { usePendingKyc } from './usePendingKyc';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('usePendingKyc', () => {
  it('loads the requested page under its own query key', async () => {
    const page = { items: [], page: 2, limit: 50, hasNextPage: false };
    const spy = jest
      .spyOn(adminService, 'getPendingKyc')
      .mockResolvedValue(page);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result, unmount } = renderHook(() => usePendingKyc(2, 50), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(page));
    expect(spy).toHaveBeenCalledWith(2, 50);
    expect(client.getQueryData(adminQueryKeys.kycPendingPage(2, 50))).toEqual(
      page,
    );
    unmount();
    client.clear();
  });
});
