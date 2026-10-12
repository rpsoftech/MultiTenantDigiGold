import { useAppSelector } from '@/store/hooks';
import { selectTenantResolved } from '@/store/tenant/tenant.slice';

// False while this host's tenant config is still loading. Until then useTenantConfig()
// returns the build-time default, so module switches (e.g. ecommerce) aren't final yet.
export function useTenantResolved(): boolean {
  return useAppSelector(selectTenantResolved);
}
