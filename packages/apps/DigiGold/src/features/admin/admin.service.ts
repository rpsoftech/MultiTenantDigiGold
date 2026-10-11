import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type {
  AdminLedgerEntry,
  AdminStats,
  AdminUserSummary,
  KycStatus,
  StorePage,
  UpdateKycStatusPayload,
} from './admin.types';
import {
  mockGetAdminStats,
  mockGetAdminUsers,
  mockGetStoreLedger,
  mockReverseLedgerEntry,
  mockUpdateKycStatus,
} from './admin.mock';

type StoreAnalyticsResponse = {
  total_volume_grams: number;
  total_revenue_inr: number;
  total_margin_earned: number;
  total_transactions: number;
};

type StoreCustomerResponse = {
  user_uuid: string;
  full_name: string | null;
  phone_number: string;
  email_id: string | null;
  total_vault_balance: number;
  kyc_status: KycStatus;
  document_json: Record<string, unknown> | null;
  created_at: string;
};

type StoreLedgerResponse = {
  gl_uuid: string;
  event_type: string;
  payment_mode: string;
  weight_grams: number;
  total_amount_inr: number;
  running_gold_balance_grams: number;
  reference_id?: string;
  // Set by the server when a SYSTEM_REVERSAL entry reverses this one; omitted when false.
  is_reversed?: boolean;
  created_at: string;
};

type StorePageResponse<T> = ApiResponse<T[] | null> & {
  page: number;
  limit: number;
};

function normalizePagination(page: number, limit: number) {
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 20,
  };
}

function mapPage<T, U>(
  response: StorePageResponse<T>,
  mapItem: (item: T) => U,
): StorePage<U> {
  const items = (response.data ?? []).map(mapItem);
  return {
    items,
    page: response.page,
    limit: response.limit,
    hasNextPage: items.length === response.limit,
  };
}

function mapCustomer(customer: StoreCustomerResponse): AdminUserSummary {
  // A new account is stored as pending before any KYC documents are submitted.
  const hasDocuments =
    customer.document_json != null &&
    Object.keys(customer.document_json).length > 0;
  const kycStatus =
    customer.kyc_status === 'pending' && !hasDocuments
      ? 'not_started'
      : customer.kyc_status;
  return {
    userId: customer.user_uuid,
    name: customer.full_name?.trim() || 'Unnamed customer',
    mobileNumber: customer.phone_number,
    email: customer.email_id || undefined,
    goldBalanceGrams: customer.total_vault_balance,
    kycStatus,
    joinedAt: customer.created_at,
  };
}

function mapLedgerEntry(entry: StoreLedgerResponse): AdminLedgerEntry {
  const reversalReference =
    entry.event_type === 'SYSTEM_REVERSAL' &&
    entry.reference_id?.startsWith('REVERSAL_')
      ? entry.reference_id.slice('REVERSAL_'.length)
      : undefined;
  return {
    id: entry.gl_uuid,
    eventType: entry.event_type,
    paymentMode: entry.payment_mode,
    weightGrams: entry.weight_grams,
    amountInr: entry.total_amount_inr,
    runningGoldBalanceGrams: entry.running_gold_balance_grams,
    timestamp: entry.created_at,
    referenceId: entry.reference_id,
    isReversed: entry.is_reversed === true,
    reversesLedgerId: reversalReference || undefined,
  };
}

// Keep the sample-data notice and service requests on the same opt-in setting.
export function isAdminDataSample(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_ADMIN === 'true';
}

export const adminService = {
  getAdminStats: async (): Promise<AdminStats> => {
    if (isAdminDataSample()) return mockGetAdminStats();
    const response = await apiClient.get<ApiResponse<StoreAnalyticsResponse>>(
      '/admin/store/analytics',
    );
    const stats = response.data.data;
    return {
      totalVolumeGrams: stats.total_volume_grams,
      totalRevenueInr: stats.total_revenue_inr,
      totalMarginEarned: stats.total_margin_earned,
      totalTransactions: stats.total_transactions,
    };
  },

  getAdminUsers: async (
    page = 1,
    limit = 20,
  ): Promise<StorePage<AdminUserSummary>> => {
    const params = normalizePagination(page, limit);
    if (isAdminDataSample())
      return mockGetAdminUsers(params.page, params.limit);
    const response = await apiClient.get<
      StorePageResponse<StoreCustomerResponse>
    >('/admin/store/customers', { params });
    return mapPage(response.data, mapCustomer);
  },

  getStoreLedger: async (
    page = 1,
    limit = 20,
  ): Promise<StorePage<AdminLedgerEntry>> => {
    const params = normalizePagination(page, limit);
    if (isAdminDataSample())
      return mockGetStoreLedger(params.page, params.limit);
    const response = await apiClient.get<
      StorePageResponse<StoreLedgerResponse>
    >('/admin/store/ledger', { params });
    return mapPage(response.data, mapLedgerEntry);
  },

  reverseLedgerEntry: async (ledgerId: string): Promise<void> => {
    if (isAdminDataSample()) return mockReverseLedgerEntry(ledgerId);
    await apiClient.post('/admin/store/ledger/reverse', {
      ledger_uuid: ledgerId,
    });
  },

  updateKycStatus: async ({
    userId,
    kycStatus,
  }: UpdateKycStatusPayload): Promise<void> => {
    if (isAdminDataSample()) return mockUpdateKycStatus(userId, kycStatus);
    await apiClient.post(
      `/admin/store/kyc/${kycStatus === 'verified' ? 'approve' : 'reject'}`,
      {
        user_uuid: userId,
      },
    );
  },
};
