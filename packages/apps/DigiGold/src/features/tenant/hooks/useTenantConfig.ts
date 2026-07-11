import { useAppSelector } from '@/store/hooks';
import { selectTenantConfig } from '@/store/tenant/tenant.slice';
import type { TenantConfig } from '../tenant.types';

export function useTenantConfig(): TenantConfig | null {
  return useAppSelector(selectTenantConfig);
}
