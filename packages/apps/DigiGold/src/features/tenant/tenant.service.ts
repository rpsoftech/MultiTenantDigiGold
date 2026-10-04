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
export async function resolveTenantConfig(): Promise<TenantConfig> {
  const response = await apiClient.get<PublicTenantInfo>('/tenant/info');
  return mapPublicTenantInfoToConfig(response.data);
}
