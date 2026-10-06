import { act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import { tenantConfigReceived } from '@/store/tenant/tenant.slice';
import { DEFAULT_TENANT_CONFIG } from '../tenant.defaults';
import { useTenantConfig } from './useTenantConfig';

describe('useTenantConfig', () => {
  it('is null until a tenant is known', () => {
    const { result } = renderHookWithProviders(() => useTenantConfig());

    expect(result.current).toBeNull();
  });

  it('returns the tenant from the store', () => {
    const { result } = renderHookWithProviders(() => useTenantConfig(), {
      preloaded: { tenant: { config: DEFAULT_TENANT_CONFIG } },
    });

    expect(result.current?.displayName).toBe('DigiGold');
  });

  it('follows a tenant that arrives later', () => {
    const { result, store } = renderHookWithProviders(() => useTenantConfig());

    act(() => {
      store.dispatch(
        tenantConfigReceived({ ...DEFAULT_TENANT_CONFIG, displayName: 'Acme' }),
      );
    });

    expect(result.current?.displayName).toBe('Acme');
  });
});
