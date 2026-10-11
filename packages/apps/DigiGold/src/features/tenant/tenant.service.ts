import { apiClient } from '@/lib/api/client';
import { mapPublicTenantInfoToConfig } from './tenant.mapper';
import type { PublicTenantInfo, TenantConfig } from './tenant.types';

// GET /tenant/info resolves the tenant purely from the X-Tenant-ID header (see
// TenantInterceptor in MainServerGo). MainServer has no endpoint that resolves a
// hostname/retailer code to a tenant UUID, so each frontend deployment is pinned to one
// tenant via NEXT_PUBLIC_TENANT_UUID (already attached to every request by apiClient) —
// there is nothing left for a retailer code to resolve at request time.
// TODO: confirm with backend — if a multi-tenant single build is ever needed, this is
// where a hostname -> tenant UUID lookup would go once MainServer exposes one.
// Tenant-specific content (e.g. jewellery) waits for this, so don't let a slow API hold
// the page for the client's general 15 s timeout: after this the build-time default is used.
export const TENANT_INFO_TIMEOUT_MS = 4000;

export async function resolveTenantConfig(): Promise<TenantConfig> {
  const response = await apiClient.get<PublicTenantInfo>('/tenant/info', {
    timeout: TENANT_INFO_TIMEOUT_MS,
  });
  return mapPublicTenantInfoToConfig(response.data);
}
