import { makeStore } from '@/store';
import { selectTenantConfig } from '@/store/tenant/tenant.slice';
import { DEFAULT_TENANT_CONFIG } from './tenant.defaults';
import { applyBuildSwitches, isJewelleryEnabledInBuild } from './buildSwitches';

const original = process.env.NEXT_PUBLIC_ENABLE_JEWELLERY;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_ENABLE_JEWELLERY;
  else process.env.NEXT_PUBLIC_ENABLE_JEWELLERY = original;
});

describe('jewellery build switch', () => {
  it('leaves jewellery on unless the build turns it off', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_JEWELLERY;
    expect(isJewelleryEnabledInBuild()).toBe(true);
    expect(applyBuildSwitches(DEFAULT_TENANT_CONFIG)).toBe(DEFAULT_TENANT_CONFIG);

    process.env.NEXT_PUBLIC_ENABLE_JEWELLERY = 'true';
    expect(applyBuildSwitches(DEFAULT_TENANT_CONFIG).activeModules.ecommerce).toBe(true);
  });

  it('switches the ecommerce module off for every tenant when the build says false', () => {
    process.env.NEXT_PUBLIC_ENABLE_JEWELLERY = 'false';

    const config = applyBuildSwitches(DEFAULT_TENANT_CONFIG);
    expect(config.activeModules.ecommerce).toBe(false);
    // Nothing else changes.
    expect(config.activeModules.vault).toBe(DEFAULT_TENANT_CONFIG.activeModules.vault);
    expect(config.displayName).toBe(DEFAULT_TENANT_CONFIG.displayName);
    // The stored tenant config is not mutated.
    expect(DEFAULT_TENANT_CONFIG.activeModules.ecommerce).toBe(true);
  });

  it('is what the app reads through selectTenantConfig, memoized', () => {
    process.env.NEXT_PUBLIC_ENABLE_JEWELLERY = 'false';
    const store = makeStore({ tenant: { config: DEFAULT_TENANT_CONFIG } });

    const first = selectTenantConfig(store.getState());
    expect(first?.activeModules.ecommerce).toBe(false);
    expect(selectTenantConfig(store.getState())).toBe(first);
  });
});
