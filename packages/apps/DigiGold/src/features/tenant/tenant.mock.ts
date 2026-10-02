import type { TenantConfig } from './tenant.types';
import { defaultTenantConfig } from './tenant.defaults';

// Explicit development fixture; live requests resolve metadata from /tenant/info.
export const mockTenantConfig: TenantConfig = {
  ...defaultTenantConfig,
  brandLogo: { ...defaultTenantConfig.brandLogo },
  theme: {
    colors: { ...defaultTenantConfig.theme.colors },
    fontFamily: { ...defaultTenantConfig.theme.fontFamily },
  },
  activeModules: { ...defaultTenantConfig.activeModules },
};
