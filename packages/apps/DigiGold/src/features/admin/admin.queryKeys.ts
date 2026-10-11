export const adminQueryKeys = {
  analytics: ['admin', 'store', 'analytics'] as const,
  customers: ['admin', 'store', 'customers'] as const,
  customerPage: (page: number, limit: number) =>
    ['admin', 'store', 'customers', page, limit] as const,
  customerPicker: ['admin', 'store', 'customers', 'picker'] as const,
  ledger: ['admin', 'store', 'ledger'] as const,
  ledgerPage: (page: number, limit: number) =>
    ['admin', 'store', 'ledger', page, limit] as const,
};
