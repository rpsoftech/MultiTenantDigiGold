export const adminQueryKeys = {
  analytics: ['admin', 'store', 'analytics'] as const,
  customers: ['admin', 'store', 'customers'] as const,
  customerPage: (page: number, limit: number) =>
    ['admin', 'store', 'customers', page, limit] as const,
  customerPicker: ['admin', 'store', 'customers', 'picker'] as const,
  kycPending: ['admin', 'store', 'kyc', 'pending'] as const,
  kycPendingPage: (page: number, limit: number) =>
    ['admin', 'store', 'kyc', 'pending', page, limit] as const,
  redemptionsPending: ['admin', 'store', 'redemptions', 'pending'] as const,
  redemptionsPendingPage: (page: number, limit: number, phone: string) =>
    ['admin', 'store', 'redemptions', 'pending', page, limit, phone] as const,
  ledger: ['admin', 'store', 'ledger'] as const,
  ledgerPage: (page: number, limit: number) =>
    ['admin', 'store', 'ledger', page, limit] as const,
};
