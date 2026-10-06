import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { apiClient } from '@/lib/api/client';
import { resolveTenantConfig } from './tenant.service';
import { DEFAULT_TENANT_CONFIG } from './tenant.defaults';

const defaultTenantConfig = DEFAULT_TENANT_CONFIG;

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resolveTenantConfig', () => {
  it('maps the public tenant API response and preserves disabled modules', async () => {
    const request = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        tenant_uuid: 'live-tenant-uuid',
        full_name: 'Live Gold Jewellers',
        short_name: 'Live Gold',
        ui_json_config: {
          tenantId: 'ignored-ui-identity',
          displayName: 'Ignored UI Name',
          brandLogo: { url: '/live-logo.svg', alt: 'Live Gold logo' },
          theme: {
            colors: { primary: '#123456', secondary: '#abc' },
            fontFamily: { headline: 'Georgia', body: 'Arial' },
          },
          activeModules: {
            home: true,
            trading: false,
            vault: false,
            ecommerce: false,
          },
        },
      },
    });

    const config = await resolveTenantConfig();

    expect(request).toHaveBeenCalledWith('/tenant/info');
    expect(config.tenantId).toBe('live-tenant-uuid');
    expect(config.displayName).toBe('Live Gold Jewellers');
    expect(config.brandLogo).toEqual({
      url: '/live-logo.svg',
      alt: 'Live Gold logo',
    });
    expect(config.theme.colors).toEqual({
      ...defaultTenantConfig.theme.colors,
      primary: '#123456',
      secondary: '#abc',
    });
    expect(config.theme.fontFamily).toEqual({
      ...defaultTenantConfig.theme.fontFamily,
      headline: 'Georgia',
      body: 'Arial',
    });
    expect(config.activeModules).toEqual({
      home: true,
      trading: false,
      vault: false,
      ecommerce: false,
    });
  });

  it.each([undefined, null, {}, [], [{ type: 'banner' }], 'invalid config'])(
    'uses theme defaults for %j UI config while retaining the real tenant identity',
    async (uiConfig) => {
      jest.spyOn(apiClient, 'get').mockResolvedValue({
        data: {
          tenant_uuid: 'live-tenant-uuid',
          full_name: 'Live Gold Jewellers',
          short_name: 'Live Gold',
          ui_json_config: uiConfig,
        },
      });

      const config = await resolveTenantConfig();

      expect(config.tenantId).toBe('live-tenant-uuid');
      expect(config.displayName).toBe('Live Gold Jewellers');
      expect(config.brandLogo).toEqual({ url: '', alt: 'Live Gold Jewellers' });
      expect(config.theme).toEqual(defaultTenantConfig.theme);
      expect(config.activeModules).toEqual(defaultTenantConfig.activeModules);
    },
  );

  it('defaults malformed nested settings without losing valid false flags', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        tenant_uuid: 'live-tenant-uuid',
        full_name: '',
        short_name: 'Live Gold',
        ui_json_config: {
          brandLogo: null,
          theme: {
            colors: { primary: 'invalid-color', secondary: null, neutral: 10 },
            fontFamily: { headline: '', body: false, label: 'Arial' },
          },
          activeModules: { home: false, trading: 'false', vault: null },
        },
      },
    });

    const config = await resolveTenantConfig();

    expect(config.displayName).toBe('Live Gold');
    expect(config.theme.colors).toEqual(defaultTenantConfig.theme.colors);
    expect(config.theme.fontFamily).toEqual({
      ...defaultTenantConfig.theme.fontFamily,
      label: 'Arial',
    });
    expect(config.activeModules).toEqual({
      ...defaultTenantConfig.activeModules,
      home: false,
    });
  });

  it('propagates API failures instead of returning a mock tenant', async () => {
    const failure = {
      message: 'Tenant not found',
      code: 'ERR_BAD_REQUEST',
      status: 404,
    };
    jest.spyOn(apiClient, 'get').mockRejectedValue(failure);

    await expect(resolveTenantConfig()).rejects.toBe(failure);
  });

  it('rejects metadata without a tenant identity instead of using the default retailer', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: { full_name: 'Live Gold Jewellers', ui_json_config: {} },
    });

    await expect(resolveTenantConfig()).rejects.toThrow(
      'Tenant API returned an invalid tenant identity.',
    );
  });
});
