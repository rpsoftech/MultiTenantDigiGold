import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type { TenantConfig } from './tenant.types';
import { mockTenantConfig } from './tenant.mock';

// MainServer's tenant config endpoint isn't ready yet — flip this one flag when it is,
// no other code here needs to change.
const USE_MOCK_TENANT_CONFIG = process.env.USE_MOCK_TENANT_CONFIG === 'true';

export async function resolveTenantConfig(retailerCode: string): Promise<TenantConfig> {
  if (USE_MOCK_TENANT_CONFIG) {
    return mockTenantConfig;
  }

  const response = await apiClient.get<ApiResponse<TenantConfig>>(
    `/tenants/${retailerCode}/config`
  );
  return response.data.data;
}
