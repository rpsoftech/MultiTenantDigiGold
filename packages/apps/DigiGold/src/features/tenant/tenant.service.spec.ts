import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { apiClient } from '@/lib/api/client';
import { computeTenantCssVars } from './tenantCssVars';
import { mockTenantConfig } from './tenant.mock';
import { resolveTenantConfig } from './tenant.service';

describe('resolveTenantConfig', () => {
  const originalMockSetting = process.env.NEXT_PUBLIC_USE_MOCK_TENANT_CONFIG;
  const tenant = {
    tenant_uuid: '01900000-0000-7000-8000-000000000002',
    full_name: 'Demo Jewellers',
    short_name: 'Demo',
    ui_json_config: {},
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_USE_MOCK_TENANT_CONFIG;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMockSetting === undefined) {
      delete process.env.NEXT_PUBLIC_USE_MOCK_TENANT_CONFIG;
    } else {
      process.env.NEXT_PUBLIC_USE_MOCK_TENANT_CONFIG = originalMockSetting;
    }
  });

  it('uses the public tenant endpoint and maps the flat response with complete visual defaults', async () => {
    const get = jest
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: tenant });

    const config = await resolveTenantConfig('demo');

    expect(get).toHaveBeenCalledWith('/tenant/info');
    expect(config).toEqual({
      ...mockTenantConfig,
      tenantId: tenant.tenant_uuid,
      displayName: tenant.full_name,
      brandLogo: { url: '', alt: tenant.full_name },
    });
    expect(() => computeTenantCssVars(config)).not.toThrow();
  });

  it('preserves configured branding, partial themes, and disabled modules', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        ...tenant,
        ui_json_config: {
          displayName: 'Custom Jewellers',
          brandLogo: { url: '/custom/logo.svg', alt: 'Custom logo' },
          theme: {
            colors: { primary: '#123456' },
            fontFamily: { body: 'Arial' },
          },
          activeModules: { trading: false, ecommerce: false },
        },
      },
    });

    const config = await resolveTenantConfig('demo');

    expect(config.displayName).toBe('Custom Jewellers');
    expect(config.brandLogo).toEqual({
      url: '/custom/logo.svg',
      alt: 'Custom logo',
    });
    expect(config.theme.colors).toEqual({
      ...mockTenantConfig.theme.colors,
      primary: '#123456',
    });
    expect(config.theme.fontFamily).toEqual({
      ...mockTenantConfig.theme.fontFamily,
      body: 'Arial',
    });
    expect(config.activeModules).toEqual({
      home: true,
      trading: false,
      vault: true,
      ecommerce: false,
    });
  });

  it.each([null, [], [{ type: 'Hero', props: { title: 'Welcome' } }]])(
    'keeps usable defaults for layout-only or missing UI configuration: %j',
    async (ui_json_config) => {
      jest
        .spyOn(apiClient, 'get')
        .mockResolvedValue({ data: { ...tenant, ui_json_config } });

      const config = await resolveTenantConfig('demo');

      expect(config.displayName).toBe(tenant.full_name);
      expect(config.theme).toEqual(mockTenantConfig.theme);
      expect(config.activeModules).toEqual(mockTenantConfig.activeModules);
      expect(config.brandLogo.url).toBe('');
    },
  );

  it('discards invalid nested values so tenant theme application remains usable', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        ...tenant,
        ui_json_config: {
          theme: {
            colors: { primary: 'invalid', secondary: null },
            fontFamily: { body: 12 },
          },
          activeModules: { trading: 'false', home: null },
        },
      },
    });

    const config = await resolveTenantConfig('demo');

    expect(config.theme).toEqual(mockTenantConfig.theme);
    expect(config.activeModules).toEqual(mockTenantConfig.activeModules);
    expect(() => computeTenantCssVars(config)).not.toThrow();
  });

  it('uses mock configuration only when explicitly enabled with the public flag', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK_TENANT_CONFIG = 'true';
    const get = jest.spyOn(apiClient, 'get');

    await expect(resolveTenantConfig('demo')).resolves.toEqual(
      mockTenantConfig,
    );

    expect(get).not.toHaveBeenCalled();
  });

  it('propagates request failures instead of silently replacing tenant data with a mock', async () => {
    const error = {
      status: 404,
      message: 'tenant not found',
      code: 'ERR_BAD_REQUEST',
    };
    jest.spyOn(apiClient, 'get').mockRejectedValue(error);

    await expect(resolveTenantConfig('demo')).rejects.toBe(error);
  });

  it.each([undefined, {}, { data: tenant }, { tenant_uuid: '' }])(
    'rejects invalid or incorrectly enveloped tenant responses: %j',
    async (data) => {
      jest.spyOn(apiClient, 'get').mockResolvedValue({ data });

      await expect(resolveTenantConfig('demo')).rejects.toThrow(
        'The server returned an invalid tenant configuration.',
      );
    },
  );
});
