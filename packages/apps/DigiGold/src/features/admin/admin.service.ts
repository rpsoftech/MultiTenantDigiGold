import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type {
  AdminLedgerEntry,
  AdminStats,
  AdminTenantOption,
  AuditEvent,
  AuditEventFilters,
  AuditEventsPage,
  AdminUserSummary,
  CounterTradePayload,
  CounterTradeReceipt,
  KycDocuments,
  KycStatus,
  CollectRedemptionPayload,
  PendingKycSubmission,
  PendingRedemption,
  StorePage,
  UpdateKycStatusPayload,
} from './admin.types';
import {
  mockGetAdminStats,
  mockGetAdminTenants,
  mockGetAdminUsers,
  mockGetAuditEvents,
  mockCreateCounterTrade,
  mockCancelRedemption,
  mockCollectRedemption,
  mockGetPendingKyc,
  mockGetPendingRedemptions,
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

type PendingKycResponse = {
  user_uuid: string;
  full_name: string | null;
  phone_number: string;
  email_id: string | null;
  city: string | null;
  total_vault_balance: number;
  document_json: Record<string, unknown> | null;
};

type PendingRedemptionResponse = {
  redemption_uuid: string;
  ledger_uuid?: string;
  weight_grams: number;
  customer_name?: string;
  customer_phone: string;
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

type CounterTradeResponse = {
  trade: {
    gl_uuid: string;
    event_type: string;
    payment_mode: string;
    weight_grams: number;
    total_amount_inr: number;
    running_gold_balance_grams: number;
    mcx_base_rate: number;
    tenant_margin_applied: number;
    gst_applied: number;
    final_rate_per_gram: number;
    created_at: string;
  };
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

const KNOWN_DOCUMENT_FIELDS = ['pan_number', 'aadhaar_last4'];

function documentValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  return undefined;
}

// document_json is customer-supplied JSON, so tolerate null, non-objects and odd value types.
export function mapKycDocuments(raw: unknown): KycDocuments {
  const doc =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const other = Object.entries(doc)
    .filter(([key]) => !KNOWN_DOCUMENT_FIELDS.includes(key))
    .flatMap(([key, value]) => {
      const text = documentValue(value);
      return text ? [{ label: key.replace(/_/g, ' '), value: text }] : [];
    });
  return {
    panNumber: documentValue(doc.pan_number),
    aadhaarLast4: documentValue(doc.aadhaar_last4),
    other,
  };
}

function mapPendingKyc(entry: PendingKycResponse): PendingKycSubmission {
  return {
    userId: entry.user_uuid,
    name: entry.full_name?.trim() || 'Unnamed customer',
    mobileNumber: entry.phone_number,
    email: entry.email_id || undefined,
    city: entry.city?.trim() || undefined,
    goldBalanceGrams: entry.total_vault_balance,
    documents: mapKycDocuments(entry.document_json),
  };
}

function mapPendingRedemption(
  entry: PendingRedemptionResponse,
): PendingRedemption {
  return {
    id: entry.redemption_uuid,
    ledgerId: entry.ledger_uuid ?? '',
    weightGrams: entry.weight_grams,
    requestedAt: entry.created_at,
    customerName: entry.customer_name?.trim() || 'Unnamed customer',
    customerPhone: entry.customer_phone,
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

type AuditEventResponse = {
  id?: string;
  _id?: string;
  key?: string;
  tenantId?: string;
  eventName: string;
  isProcessed?: boolean;
  parentNames?: string[] | null;
  payload?: unknown;
  ipAddressAOccurredFrom?: string;
  adminId?: string;
  occurredAt: string;
};

// Unlike the store endpoints this has no success envelope, and data is null when nothing matches.
type AuditEventsResponse = {
  data: AuditEventResponse[] | null;
  total: number;
};

type TenantListResponse = {
  data: { tenant_uuid: string; full_name: string; short_name?: string | null }[] | null;
  total: number;
};

const TENANT_PAGE_SIZE = 100;
// Guards the tenant loop against a server that never reports a consistent total.
const MAX_TENANT_PAGES = 50;

function mapAuditEvent(event: AuditEventResponse): AuditEvent {
  return {
    id: event.id ?? event._id ?? '',
    key: event.key ?? '',
    tenantId: event.tenantId ?? '',
    eventName: event.eventName,
    isProcessed: event.isProcessed === true,
    parentNames: event.parentNames ?? [],
    payload: event.payload ?? null,
    ipAddress: event.ipAddressAOccurredFrom || undefined,
    adminId: event.adminId || undefined,
    occurredAt: event.occurredAt,
  };
}

// The server casts from/to to a timestamp without a time zone and rejects anything else
// with a 500, so send plain local date-times covering the whole of each chosen day.
function auditEventParams(
  filters: AuditEventFilters,
  page: number,
  limit: number,
) {
  return {
    page,
    limit,
    ...(filters.tenantUuid ? { tenant_uuid: filters.tenantUuid } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.from ? { from: `${filters.from}T00:00:00` } : {}),
    ...(filters.to ? { to: `${filters.to}T23:59:59` } : {}),
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

  getPendingKyc: async (
    page = 1,
    limit = 20,
  ): Promise<StorePage<PendingKycSubmission>> => {
    const params = normalizePagination(page, limit);
    if (isAdminDataSample()) return mockGetPendingKyc(params.page, params.limit);
    const response = await apiClient.get<
      StorePageResponse<PendingKycResponse>
    >('/admin/store/kyc/pending', { params });
    return mapPage(response.data, mapPendingKyc);
  },

  // phone is an exact 10-digit match on MainServer; an empty string lists everyone.
  getPendingRedemptions: async (
    page = 1,
    limit = 20,
    phone = '',
  ): Promise<StorePage<PendingRedemption>> => {
    const { page: safePage, limit: safeLimit } = normalizePagination(
      page,
      limit,
    );
    const trimmedPhone = phone.trim();
    if (isAdminDataSample())
      return mockGetPendingRedemptions(safePage, safeLimit, trimmedPhone);
    const params: Record<string, string | number> = {
      page: safePage,
      limit: safeLimit,
    };
    if (trimmedPhone) params.phone = trimmedPhone;
    const response = await apiClient.get<
      StorePageResponse<PendingRedemptionResponse>
    >('/admin/store/redemptions/pending', { params });
    return mapPage(response.data, mapPendingRedemption);
  },

  collectRedemption: async ({
    redemptionId,
    pickupCode,
  }: CollectRedemptionPayload): Promise<void> => {
    if (isAdminDataSample())
      return mockCollectRedemption(redemptionId, pickupCode);
    await apiClient.post('/admin/store/redemptions/collect', {
      redemption_uuid: redemptionId,
      pickup_code: pickupCode,
    });
  },

  // Returns the grams to the customer's vault by reversing the redemption's ledger debit.
  cancelRedemption: async (redemptionId: string): Promise<void> => {
    if (isAdminDataSample()) return mockCancelRedemption(redemptionId);
    await apiClient.post('/admin/store/redemptions/cancel', {
      redemption_uuid: redemptionId,
    });
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

  getAuditEvents: async (
    filters: AuditEventFilters = {},
    page = 1,
    limit = 20,
  ): Promise<AuditEventsPage> => {
    const params = normalizePagination(page, limit);
    if (isAdminDataSample())
      return mockGetAuditEvents(filters, params.page, params.limit);
    const response = await apiClient.get<AuditEventsResponse>('/admin/events', {
      params: auditEventParams(filters, params.page, params.limit),
    });
    const total = response.data.total ?? 0;
    return {
      items: (response.data.data ?? []).map(mapAuditEvent),
      total,
      // The server echoes the raw page and limit it was sent, so use the normalised ones.
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  },

  getAdminTenants: async (): Promise<AdminTenantOption[]> => {
    if (isAdminDataSample()) return mockGetAdminTenants();
    const tenants: AdminTenantOption[] = [];
    for (let page = 1; page <= MAX_TENANT_PAGES; page += 1) {
      const response = await apiClient.get<TenantListResponse>('/admin/tenants', {
        params: { page, limit: TENANT_PAGE_SIZE },
      });
      const batch = response.data.data ?? [];
      tenants.push(
        ...batch.map((tenant) => ({
          tenantUuid: tenant.tenant_uuid,
          name: tenant.short_name?.trim() || tenant.full_name,
        })),
      );
      if (batch.length < TENANT_PAGE_SIZE || tenants.length >= response.data.total)
        break;
    }
    return tenants;
  },

  reverseLedgerEntry: async (ledgerId: string): Promise<void> => {
    if (isAdminDataSample()) return mockReverseLedgerEntry(ledgerId);
    await apiClient.post('/admin/store/ledger/reverse', {
      ledger_uuid: ledgerId,
    });
  },

  createCounterTrade: async (
    payload: CounterTradePayload,
  ): Promise<CounterTradeReceipt> => {
    if (isAdminDataSample()) return mockCreateCounterTrade(payload);
    const response = await apiClient.post<CounterTradeResponse>(
      '/admin/store/trade/counter',
      {
        user_uuid: payload.userId,
        requested_rate_per_gram: payload.ratePerGram,
        payment_mode: payload.paymentMode,
        ...(payload.weightGrams !== undefined
          ? { weight_grams: payload.weightGrams }
          : { total_amount_inr: payload.amountInr }),
      },
    );
    const trade = response.data.trade;
    return {
      id: trade.gl_uuid,
      eventType: trade.event_type,
      paymentMode: trade.payment_mode,
      weightGrams: trade.weight_grams,
      amountInr: trade.total_amount_inr,
      ratePerGram: trade.final_rate_per_gram,
      mcxBaseRate: trade.mcx_base_rate,
      marginInr: trade.tenant_margin_applied,
      gstInr: trade.gst_applied,
      runningGoldBalanceGrams: trade.running_gold_balance_grams,
      createdAt: trade.created_at,
    };
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
