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

const redemption = {
  redemption_uuid: 'redemption-uuid',
  ledger_uuid: 'ledger-uuid',
  weight_grams: 2.5,
  status: 'PENDING',
  created_at: '2026-10-09T08:00:00Z',
  customer_name: ' Asha Rao ',
  customer_phone: '9876543210',
};

describe('adminService redemptions', () => {
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

  it('maps the pending pickups and omits the phone filter when it is empty', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, page: 1, limit: 1, data: [redemption] },
    });

    const result = await adminService.getPendingRedemptions(1, 1);

    expect(get).toHaveBeenCalledWith('/admin/store/redemptions/pending', {
      params: { page: 1, limit: 1 },
    });
    expect(result).toEqual({
      items: [
        {
          id: 'redemption-uuid',
          ledgerId: 'ledger-uuid',
          weightGrams: 2.5,
          requestedAt: '2026-10-09T08:00:00Z',
          customerName: 'Asha Rao',
          customerPhone: '9876543210',
        },
      ],
      page: 1,
      limit: 1,
      hasNextPage: true,
    });
  });

  it('sends the phone filter, falls back for a missing name and treats null data as empty', async () => {
    const get = jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        data: {
          success: true,
          page: 1,
          limit: 20,
          data: [{ ...redemption, customer_name: undefined }],
        },
      })
      .mockResolvedValueOnce({
        data: { success: true, page: 1, limit: 20, data: null },
      });

    const named = await adminService.getPendingRedemptions(1, 20, ' 9876543210 ');
    expect(get).toHaveBeenNthCalledWith(1, '/admin/store/redemptions/pending', {
      params: { page: 1, limit: 20, phone: '9876543210' },
    });
    expect(named.items[0].customerName).toBe('Unnamed customer');

    const empty = await adminService.getPendingRedemptions(0, 500);
    expect(get).toHaveBeenNthCalledWith(2, '/admin/store/redemptions/pending', {
      params: { page: 1, limit: 20 },
    });
    expect(empty.items).toEqual([]);
    expect(empty.hasNextPage).toBe(false);
  });

  it('posts the redemption uuid and pickup code to collect', async () => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { success: true } });

    await expect(
      adminService.collectRedemption({
        redemptionId: 'redemption-uuid',
        pickupCode: '482915',
      }),
    ).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith('/admin/store/redemptions/collect', {
      redemption_uuid: 'redemption-uuid',
      pickup_code: '482915',
    });
  });

  it('posts only the redemption uuid to cancel', async () => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { success: true } });

    await expect(
      adminService.cancelRedemption('redemption-uuid'),
    ).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith('/admin/store/redemptions/cancel', {
      redemption_uuid: 'redemption-uuid',
    });
  });

  it('propagates a wrong-code error so the caller can react to it', async () => {
    const error = {
      status: 400,
      code: 'INVALID_PICKUP_CODE',
      message: 'Pickup code does not match.',
    };
    jest.spyOn(apiClient, 'post').mockRejectedValue(error);

    await expect(
      adminService.collectRedemption({
        redemptionId: 'redemption-uuid',
        pickupCode: '000000',
      }),
    ).rejects.toBe(error);
  });
});

describe('adminService redemptions in sample mode', () => {
  const originalMockSetting = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = 'true';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMockSetting === undefined) {
      delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;
    } else {
      process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = originalMockSetting;
    }
  });

  it('behaves like the server: wrong code, collect, repeat collect, cancel, unknown id', async () => {
    const get = jest.spyOn(apiClient, 'get');
    const post = jest.spyOn(apiClient, 'post');

    const all = await adminService.getPendingRedemptions();
    expect(all.items.map((item) => item.id)).toEqual([
      'RDM-201',
      'RDM-202',
      'RDM-203',
    ]);
    const filtered = await adminService.getPendingRedemptions(
      1,
      20,
      '9123456789',
    );
    expect(filtered.items.map((item) => item.id)).toEqual(['RDM-202']);

    await expect(
      adminService.collectRedemption({
        redemptionId: 'RDM-201',
        pickupCode: '000000',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_PICKUP_CODE' });

    await adminService.collectRedemption({
      redemptionId: 'RDM-201',
      pickupCode: '482915',
    });
    await expect(
      adminService.collectRedemption({
        redemptionId: 'RDM-201',
        pickupCode: '482915',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'REDEMPTION_NOT_PENDING' });
    await expect(adminService.cancelRedemption('RDM-201')).rejects.toMatchObject(
      { status: 409, code: 'REDEMPTION_NOT_PENDING' },
    );

    await adminService.cancelRedemption('RDM-203');
    await expect(adminService.cancelRedemption('RDM-203')).rejects.toMatchObject(
      { status: 409 },
    );
    await expect(adminService.cancelRedemption('nope')).rejects.toMatchObject({
      status: 404,
      code: 'REDEMPTION_NOT_FOUND',
    });

    const remaining = await adminService.getPendingRedemptions();
    expect(remaining.items.map((item) => item.id)).toEqual(['RDM-202']);
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
