import type { TenantConfig } from './tenant.types';

// Build-level switches that apply to every tenant, on top of their own activeModules.
//
// NEXT_PUBLIC_ENABLE_JEWELLERY=false hides the jewellery catalogue (nav link, home page
// sections, /jewellery pages). Production sets it while MainServer has no catalogue API, so
// customers never see the sample catalogue, its prices or its specs.
export function isJewelleryEnabledInBuild(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_JEWELLERY !== 'false';
}

export function applyBuildSwitches(config: TenantConfig): TenantConfig {
  if (isJewelleryEnabledInBuild() || !config.activeModules.ecommerce) return config;
  return {
    ...config,
    activeModules: { ...config.activeModules, ecommerce: false },
  };
}
