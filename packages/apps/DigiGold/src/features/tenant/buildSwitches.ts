import type { TenantConfig } from './tenant.types';

// Build-level switches that apply to every tenant, on top of their own activeModules.
//
// NEXT_PUBLIC_ENABLE_JEWELLERY=false hides the jewellery catalogue (nav link, home page
// sections, /jewellery pages) while MainServer has no catalogue API, so customers never see
// the sample catalogue, its prices or its specs. Left unset it is on in development and
// tests but off in production builds: a production .env written before this switch existed
// must not show the catalogue by accident. Any `next build` that should show it (staging,
// or production once the API exists) sets it to `true`.
export function isJewelleryEnabledInBuild(): boolean {
  const value = process.env.NEXT_PUBLIC_ENABLE_JEWELLERY;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export function applyBuildSwitches(config: TenantConfig): TenantConfig {
  if (isJewelleryEnabledInBuild() || !config.activeModules.ecommerce)
    return config;
  return {
    ...config,
    activeModules: { ...config.activeModules, ecommerce: false },
  };
}
