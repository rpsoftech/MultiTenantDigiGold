import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { apiClient } from '@/lib/api/client';
import { adminService } from './admin.service';
import { auditEventLabel, formatAuditTimestamp } from './audit.constants';

const rawEvent = {
  _id: 'evt-1',
  id: 'evt-1',
  key: 'key-1',
  tenantId: 'tenant-uuid',
  eventName: 'ADMIN_LOGGED_IN',
  isProcessed: true,
  parentNames: null,
  payload: { role: 'super_admin' },
  ipAddressAOccurredFrom: '1.2.3.4',
  adminId: 'adm-1',
  occurredAt: '2026-10-09T10:00:00Z',
};

describe('adminService audit events', () => {
  const originalMockSetting = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMockSetting === undefined) {
      delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;
    } else {
      process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = originalMockSetting;
    }
  });

  it('maps events and uses the normalised page and limit, not the echoed ones', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: { data: [rawEvent], total: 41, page: 0, limit: 500 },
    });

    const page = await adminService.getAuditEvents({}, 0, 500);

    expect(get).toHaveBeenCalledWith('/admin/events', {
      params: { page: 1, limit: 20 },
    });
    expect(page).toEqual({
      items: [
        {
          id: 'evt-1',
          key: 'key-1',
          tenantId: 'tenant-uuid',
          eventName: 'ADMIN_LOGGED_IN',
          isProcessed: true,
          parentNames: [],
          payload: { role: 'super_admin' },
          ipAddress: '1.2.3.4',
          adminId: 'adm-1',
          occurredAt: '2026-10-09T10:00:00Z',
        },
      ],
      total: 41,
      page: 1,
      limit: 20,
      totalPages: 3,
    });
  });

  it('sends only the filters that are set, covering whole days for from and to', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: { data: [], total: 0 },
    });

    await adminService.getAuditEvents(
      {
        tenantUuid: 'tenant-uuid',
        type: 'MARGIN_UPDATED',
        from: '2026-10-01',
        to: '2026-10-09',
      },
      2,
      50,
    );

    expect(get).toHaveBeenCalledWith('/admin/events', {
      params: {
        page: 2,
        limit: 50,
        tenant_uuid: 'tenant-uuid',
        type: 'MARGIN_UPDATED',
        from: '2026-10-01T00:00:00',
        to: '2026-10-09T23:59:59',
      },
    });
  });

  it('treats a null data array as no events with a single empty page', async () => {
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: { data: null, total: 0 } });

    const page = await adminService.getAuditEvents({ type: '' });

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
    expect(page.totalPages).toBe(1);
    expect(apiClient.get).toHaveBeenCalledWith('/admin/events', {
      params: { page: 1, limit: 20 },
    });
  });

  it('tolerates events without optional fields', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        data: [{ eventName: 'TenantCreated', occurredAt: '2026-10-09T10:00:00Z' }],
        total: 1,
      },
    });

    const { items } = await adminService.getAuditEvents();

    expect(items[0]).toMatchObject({
      id: '',
      tenantId: '',
      isProcessed: false,
      parentNames: [],
      payload: null,
      ipAddress: undefined,
      adminId: undefined,
    });
  });

  it('serves sample events and filters them in demo mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = 'true';
    const get = jest.spyOn(apiClient, 'get');

    const all = await adminService.getAuditEvents();
    const margin = await adminService.getAuditEvents({ type: 'MARGIN_UPDATED' });
    const outOfRange = await adminService.getAuditEvents({ from: '2030-01-01' });

    expect(all.total).toBeGreaterThan(1);
    expect(margin.items.map((event) => event.eventName)).toEqual([
      'MARGIN_UPDATED',
    ]);
    expect(outOfRange.items).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it('loads every tenant page and prefers the short name', async () => {
    const tenant = (n: number, shortName: string | null) => ({
      tenant_uuid: `uuid-${n}`,
      full_name: `Tenant ${n}`,
      short_name: shortName,
    });
    const firstPage = Array.from({ length: 100 }, (_, i) => tenant(i, null));
    const get = jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { data: firstPage, total: 101 } })
      .mockResolvedValueOnce({ data: { data: [tenant(100, 'Short')], total: 101 } });

    const tenants = await adminService.getAdminTenants();

    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(2, '/admin/tenants', {
      params: { page: 2, limit: 100 },
    });
    expect(tenants).toHaveLength(101);
    expect(tenants[0]).toEqual({ tenantUuid: 'uuid-0', name: 'Tenant 0' });
    expect(tenants[100]).toEqual({ tenantUuid: 'uuid-100', name: 'Short' });
  });

  it('handles a null tenant list', async () => {
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: { data: null, total: 0 } });
    await expect(adminService.getAdminTenants()).resolves.toEqual([]);
  });
});

describe('audit helpers', () => {
  it.each([
    ['ADMIN_LOGGED_IN', 'Admin logged in'],
    ['TenantConfigUpdated', 'Tenant config updated'],
    ['OTPVerifyEvent', 'Otpverify event'],
  ])('labels %s as %s', (name, label) => {
    expect(auditEventLabel(name)).toBe(label);
  });

  it('formats timestamps in IST and tolerates invalid ones', () => {
    expect(formatAuditTimestamp('2026-10-09T10:00:00Z')).toContain('3:30:00');
    expect(formatAuditTimestamp('nope')).toBe('—');
  });
});
