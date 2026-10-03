import { apiClient } from '@/lib/api/client';
import { DEFAULT_TENANT_UI } from './tenant.defaults';
import { resolveTenantConfig } from './tenant.service';

jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn() },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('resolveTenantConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the tenant from /tenant/info and maps it to a UI config', async () => {
    mockedClient.get.mockResolvedValue({
      data: {
        tenant_uuid: 'tenant-1',
        full_name: 'Acme Jewellers',
        short_name: 'acme',
        domain: null,
        subdomain: 'acme',
        kyc_mode: 'just_in_time',
        ui_json_config: {
          brandLogo: { url: 'https://cdn.example.com/logo.png', alt: 'Acme' },
          activeModules: { ecommerce: false },
        },
      },
    });

    const config = await resolveTenantConfig();

    expect(mockedClient.get).toHaveBeenCalledWith('/tenant/info');
    expect(config.tenantId).toBe('tenant-1');
    expect(config.displayName).toBe('Acme Jewellers');
    expect(config.brandLogo.url).toBe('https://cdn.example.com/logo.png');
    expect(config.activeModules.ecommerce).toBe(false);
    expect(config.theme).toEqual(DEFAULT_TENANT_UI.theme);
  });

  it('lets a request failure reach the caller so the default theme can stay', async () => {
    mockedClient.get.mockRejectedValue({ status: 404, message: 'tenant not found' });

    await expect(resolveTenantConfig()).rejects.toMatchObject({ status: 404 });
  });
});
