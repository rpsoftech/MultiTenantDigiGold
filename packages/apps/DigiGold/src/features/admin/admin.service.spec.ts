import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { apiClient } from '@/lib/api/client';
import { adminService, isAdminDataSample } from './admin.service';

const customer = {
  user_uuid: 'customer-uuid',
  full_name: 'Priya Patel',
  phone_number: '9123456789',
  email_id: 'priya@example.com',
  total_vault_balance: 12.1234,
  kyc_status: 'pending',
  document_json: { pan: 'submitted' },
  created_at: '2026-10-05T10:00:00Z',
};

const ledgerEntry = {
  gl_uuid: 'ledger-uuid',
  event_type: 'GOLD_PURCHASE',
  payment_mode: 'COUNTER_UPI',
  weight_grams: 1.1234,
  total_amount_inr: 8342.56,
  running_gold_balance_grams: 12.1234,
  reference_id: 'counter-ref',
  created_at: '2026-10-05T10:00:00Z',
};

describe('adminService store integration', () => {
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

  it('defaults to live data when the sample-data flag is unset', () => {
    expect(isAdminDataSample()).toBe(false);
  });

  it('returns sample analytics without requesting the API when explicitly enabled', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = 'true';
    const get = jest.spyOn(apiClient, 'get');

    await expect(adminService.getAdminStats()).resolves.toEqual({
      totalVolumeGrams: 1140.32,
      totalRevenueInr: 8245310,
      totalMarginEarned: 164906.2,
      totalTransactions: 286,
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('maps all four analytics metrics from the store endpoint', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          total_volume_grams: 234.1234,
          total_revenue_inr: 1743456.78,
          total_margin_earned: 12345.67,
          total_transactions: 43,
        },
      },
    });

    await expect(adminService.getAdminStats()).resolves.toEqual({
      totalVolumeGrams: 234.1234,
      totalRevenueInr: 1743456.78,
      totalMarginEarned: 12345.67,
      totalTransactions: 43,
    });
    expect(get).toHaveBeenCalledWith('/admin/store/analytics');
  });

  it('maps customer identity, vault balance and pagination from a later page', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: [customer], page: 3, limit: 1 },
    });

    await expect(adminService.getAdminUsers(3, 1)).resolves.toEqual({
      items: [
        {
          userId: customer.user_uuid,
          name: customer.full_name,
          mobileNumber: customer.phone_number,
          email: customer.email_id,
          goldBalanceGrams: customer.total_vault_balance,
          kycStatus: 'pending',
          joinedAt: customer.created_at,
        },
      ],
      page: 3,
      limit: 1,
      hasNextPage: true,
    });
    expect(get).toHaveBeenCalledWith('/admin/store/customers', {
      params: { page: 3, limit: 1 },
    });
  });

  it('handles nullable identity fields and distinguishes unsubmitted KYC from review requests', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: [
          { ...customer, full_name: null, email_id: null, document_json: {} },
          { ...customer, kyc_status: 'verified', document_json: null },
        ],
        page: 1,
        limit: 20,
      },
    });

    const result = await adminService.getAdminUsers();
    expect(result.items[0]).toMatchObject({
      name: 'Unnamed customer',
      email: undefined,
      kycStatus: 'not_started',
    });
    expect(result.items[1].kycStatus).toBe('verified');
    expect(result.hasNextPage).toBe(false);
  });

  it('accepts the Go null response for an empty directory or ledger', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: null, page: 1, limit: 20 },
    });

    const emptyPage = { items: [], page: 1, limit: 20, hasNextPage: false };
    await expect(adminService.getAdminUsers()).resolves.toEqual(emptyPage);
    await expect(adminService.getStoreLedger()).resolves.toEqual(emptyPage);
  });

  it('normalizes invalid pagination with the backend defaults', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: [], page: 1, limit: 20 },
    });

    await adminService.getAdminUsers(-1, 101);
    await adminService.getStoreLedger(1.5, 0);
    expect(get).toHaveBeenNthCalledWith(1, '/admin/store/customers', {
      params: { page: 1, limit: 20 },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/admin/store/ledger', {
      params: { page: 1, limit: 20 },
    });
  });

  it('preserves signed ledger values, payment mode, running balance and reversal references', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            ...ledgerEntry,
            gl_uuid: 'reversal-uuid',
            event_type: 'SYSTEM_REVERSAL',
            payment_mode: 'NONE',
            weight_grams: -1.1234,
            total_amount_inr: -8342.56,
            running_gold_balance_grams: 11,
            reference_id: 'REVERSAL_ledger-uuid',
          },
          ledgerEntry,
          {
            ...ledgerEntry,
            gl_uuid: 'metadata-reversed',
            metadata_json: { is_reversed: true },
          },
        ],
        page: 2,
        limit: 20,
      },
    });

    const result = await adminService.getStoreLedger(2);
    expect(get).toHaveBeenCalledWith('/admin/store/ledger', {
      params: { page: 2, limit: 20 },
    });
    expect(result.items[0]).toEqual({
      id: 'reversal-uuid',
      eventType: 'SYSTEM_REVERSAL',
      paymentMode: 'NONE',
      weightGrams: -1.1234,
      amountInr: -8342.56,
      runningGoldBalanceGrams: 11,
      timestamp: ledgerEntry.created_at,
      referenceId: 'REVERSAL_ledger-uuid',
      isReversed: false,
      reversesLedgerId: 'ledger-uuid',
    });
    expect(result.items[1].isReversed).toBe(true);
    expect(result.items[2].isReversed).toBe(true);
  });

  it('loads recent customers and activity from the first store page', async () => {
    const get = jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        data: { success: true, data: [customer], page: 1, limit: 5 },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: [ledgerEntry], page: 1, limit: 5 },
      });

    expect(await adminService.getRecentUsers()).toHaveLength(1);
    expect(await adminService.getRecentTransactions()).toHaveLength(1);
    expect(get).toHaveBeenNthCalledWith(1, '/admin/store/customers', {
      params: { page: 1, limit: 5 },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/admin/store/ledger', {
      params: { page: 1, limit: 5 },
    });
  });

  it.each([
    { kycStatus: 'verified' as const, action: 'approve' },
    { kycStatus: 'rejected' as const, action: 'reject' },
  ])(
    'posts KYC $action with the backend customer UUID field',
    async ({ kycStatus, action }) => {
      const post = jest
        .spyOn(apiClient, 'post')
        .mockResolvedValue({ data: { success: true, message: 'KYC updated' } });

      await expect(
        adminService.updateKycStatus({ userId: 'customer-uuid', kycStatus }),
      ).resolves.toBeUndefined();
      expect(post).toHaveBeenCalledWith(`/admin/store/kyc/${action}`, {
        user_uuid: 'customer-uuid',
      });
    },
  );

  it('propagates API errors instead of replacing a failed request with an empty page', async () => {
    const error = { status: 500, message: 'Unable to fetch ledger' };
    jest.spyOn(apiClient, 'get').mockRejectedValue(error);

    await expect(adminService.getStoreLedger()).rejects.toBe(error);
  });
});
