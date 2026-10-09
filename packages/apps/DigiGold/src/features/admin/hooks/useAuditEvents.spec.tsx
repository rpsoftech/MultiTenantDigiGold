import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';
import { useAuditEvents } from './useAuditEvents';
import { useAdminTenants } from './useAdminTenants';

afterEach(() => {
  jest.restoreAllMocks();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('useAuditEvents', () => {
  it('loads the requested filters and page under their own query key', async () => {
    const filters = { tenantUuid: 't-1', type: 'MARGIN_UPDATED' };
    const page = { items: [], total: 0, page: 2, limit: 50, totalPages: 1 };
    const spy = jest.spyOn(adminService, 'getAuditEvents').mockResolvedValue(page);
    const { client, wrapper } = setup();

    const { result, unmount } = renderHook(
      () => useAuditEvents(filters, 2, 50),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(page));
    expect(spy).toHaveBeenCalledWith(filters, 2, 50);
    expect(
      client.getQueryData(adminQueryKeys.auditEventsPage(filters, 2, 50)),
    ).toEqual(page);
    unmount();
    client.clear();
  });

  it('keeps the previous rows while new filters load', async () => {
    const first = { items: [], total: 1, page: 1, limit: 20, totalPages: 1 };
    let resolveSecond: (value: typeof first) => void = () => undefined;
    const spy = jest
      .spyOn(adminService, 'getAuditEvents')
      .mockResolvedValueOnce(first)
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    const { client, wrapper } = setup();

    const { result, rerender, unmount } = renderHook(
      ({ type }) => useAuditEvents({ type }, 1, 20),
      { wrapper, initialProps: { type: 'A' } },
    );
    await waitFor(() => expect(result.current.data).toEqual(first));

    rerender({ type: 'B' });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toEqual(first);
    resolveSecond({ ...first, total: 2 });
    await waitFor(() => expect(result.current.data?.total).toBe(2));
    expect(spy).toHaveBeenCalledTimes(2);
    unmount();
    client.clear();
  });
});

describe('useAdminTenants', () => {
  it('loads the tenant options', async () => {
    const tenants = [{ tenantUuid: 't-1', name: 'DigiGold' }];
    jest.spyOn(adminService, 'getAdminTenants').mockResolvedValue(tenants);
    const { client, wrapper } = setup();

    const { result, unmount } = renderHook(() => useAdminTenants(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(tenants));
    expect(client.getQueryData(adminQueryKeys.auditTenants)).toEqual(tenants);
    unmount();
    client.clear();
  });
});
