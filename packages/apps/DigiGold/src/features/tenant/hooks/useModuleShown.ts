import type { TenantConfig } from '../tenant.types';
import { useTenantConfig } from './useTenantConfig';
import { useTenantResolved } from './useTenantResolved';

export type TenantModule = keyof TenantConfig['activeModules'];

// Whether to offer a link or section that belongs to a tenant module. The jewellery
// catalogue (ecommerce) waits for this host's tenant config: the build-time default has it
// on, so a tenant with it off saw jewellery links flash in until /tenant/info answered.
// Other modules (vault, trading) are on for nearly every tenant, so they use the default
// meanwhile rather than make the navigation jump.
export function useModuleShown(): (module?: TenantModule) => boolean {
  const tenantConfig = useTenantConfig();
  const tenantResolved = useTenantResolved();
  return (module) => {
    if (!module) return true;
    // No config at all yet: offer only what belongs to no module.
    if (!tenantConfig) return false;
    if (module === 'ecommerce' && !tenantResolved) return false;
    return tenantConfig.activeModules[module];
  };
}
