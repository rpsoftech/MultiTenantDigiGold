import { makeStore } from '@/store';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import {
  selectLayoutStatus,
  selectTenantConfig,
  selectTenantResolved,
  tenantConfigReceived,
  tenantConfigUnavailable,
} from './tenant.slice';

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

  it('stays unresolved until the host tenant arrives', () => {
    const store = makeStore({
      tenant: { config: DEFAULT_TENANT_CONFIG, resolved: false },
    });
    expect(selectTenantResolved(store.getState())).toBe(false);

    store.dispatch(tenantConfigReceived(DEFAULT_TENANT_CONFIG));
    expect(selectTenantResolved(store.getState())).toBe(true);
  });

  it('resolves with the default config when the tenant API fails', () => {
    const store = makeStore({
      tenant: { config: DEFAULT_TENANT_CONFIG, resolved: false },
    });

    store.dispatch(tenantConfigUnavailable());

    expect(selectTenantResolved(store.getState())).toBe(true);
    expect(selectTenantConfig(store.getState())?.displayName).toBe(
      DEFAULT_TENANT_CONFIG.displayName,
    );
  });

  describe('layout status', () => {
    const published = { ...DEFAULT_TENANT_CONFIG, tenantId: 't', layout: [] };

    it('is loading until a tenant response has been read', () => {
      const store = makeStore({
        tenant: { config: DEFAULT_TENANT_CONFIG, resolved: false },
      });

      expect(selectLayoutStatus(store.getState())).toBe('loading');
    });

    it('is ready once the tenant arrives, even with nothing published', () => {
      const store = makeStore({
        tenant: { config: DEFAULT_TENANT_CONFIG, resolved: false },
      });

      store.dispatch(tenantConfigReceived(published));

      expect(selectLayoutStatus(store.getState())).toBe('ready');
    });

    it('is unavailable when the first load fails', () => {
      const store = makeStore({
        tenant: { config: DEFAULT_TENANT_CONFIG, resolved: false },
      });

      store.dispatch(tenantConfigUnavailable());

      expect(selectLayoutStatus(store.getState())).toBe('unavailable');
    });

    it('stays ready when a later refresh fails', () => {
      const store = makeStore({ tenant: { config: published } });

      store.dispatch(tenantConfigUnavailable());

      expect(selectLayoutStatus(store.getState())).toBe('ready');
    });

    it('recovers when a retry succeeds', () => {
      const store = makeStore({
        tenant: { config: DEFAULT_TENANT_CONFIG, resolved: false },
      });

      store.dispatch(tenantConfigUnavailable());
      store.dispatch(tenantConfigReceived(published));

      expect(selectLayoutStatus(store.getState())).toBe('ready');
    });
  });
});
