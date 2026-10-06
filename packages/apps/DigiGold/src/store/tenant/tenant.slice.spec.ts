import { makeStore } from '@/store';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { selectTenantConfig, tenantConfigReceived } from './tenant.slice';

describe('tenant slice', () => {
  it('starts without a tenant', () => {
    expect(selectTenantConfig(makeStore().getState())).toBeNull();
  });

  it('can start with the server-rendered tenant', () => {
    const store = makeStore({ tenant: { config: DEFAULT_TENANT_CONFIG } });

    expect(selectTenantConfig(store.getState())).toEqual(DEFAULT_TENANT_CONFIG);
  });

  it('replaces the tenant when a new config arrives', () => {
    const store = makeStore({ tenant: { config: DEFAULT_TENANT_CONFIG } });

    store.dispatch(
      tenantConfigReceived({ ...DEFAULT_TENANT_CONFIG, displayName: 'Acme' }),
    );

    expect(selectTenantConfig(store.getState())?.displayName).toBe('Acme');
  });
});
