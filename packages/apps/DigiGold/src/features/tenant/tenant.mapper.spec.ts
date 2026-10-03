import { DEFAULT_TENANT_UI } from './tenant.defaults';
import { mapPublicTenantInfoToConfig } from './tenant.mapper';
import type { PublicTenantInfo } from './tenant.types';

function makeInfo(uiConfig: unknown): PublicTenantInfo {
  return {
    tenant_uuid: 'tenant-1',
    full_name: 'Acme Jewellers',
    short_name: 'acme',
    domain: 'acme.example.com',
    subdomain: 'acme',
    kyc_mode: 'upfront',
    ui_json_config: uiConfig,
  };
}

describe('mapPublicTenantInfoToConfig', () => {
  it('maps the identity fields from the server response', () => {
    const config = mapPublicTenantInfoToConfig(makeInfo({}));

    expect(config).toMatchObject({
      tenantId: 'tenant-1',
      displayName: 'Acme Jewellers',
      shortName: 'acme',
      domain: 'acme.example.com',
      subdomain: 'acme',
      kycMode: 'upfront',
    });
  });

  it('keeps null optional fields as null', () => {
    const config = mapPublicTenantInfoToConfig({
      ...makeInfo({}),
      short_name: null,
      domain: null,
      subdomain: null,
    });

    expect(config.shortName).toBeNull();
    expect(config.domain).toBeNull();
    expect(config.subdomain).toBeNull();
  });

  describe.each([[undefined], [null], ['text'], [42], [[]]])('with an unusable ui config %p', (ui) => {
    it('falls back to the brand-neutral defaults', () => {
      const config = mapPublicTenantInfoToConfig(makeInfo(ui));

      expect(config.brandLogo).toEqual(DEFAULT_TENANT_UI.brandLogo);
      expect(config.theme).toEqual(DEFAULT_TENANT_UI.theme);
      expect(config.activeModules).toEqual(DEFAULT_TENANT_UI.activeModules);
    });
  });

  describe('brand logo', () => {
    it('uses the configured logo and alt text', () => {
      const config = mapPublicTenantInfoToConfig(
        makeInfo({ brandLogo: { url: 'https://cdn.example.com/logo.png', alt: 'Acme' } }),
      );

      expect(config.brandLogo).toEqual({ url: 'https://cdn.example.com/logo.png', alt: 'Acme' });
    });

    it('uses an empty alt text when none is configured', () => {
      const config = mapPublicTenantInfoToConfig(
        makeInfo({ brandLogo: { url: 'https://cdn.example.com/logo.png' } }),
      );

      expect(config.brandLogo.alt).toBe('');
    });

    it('falls back to the default logo when the url is missing or not a string', () => {
      expect(mapPublicTenantInfoToConfig(makeInfo({ brandLogo: { alt: 'x' } })).brandLogo).toEqual(
        DEFAULT_TENANT_UI.brandLogo,
      );
      expect(
        mapPublicTenantInfoToConfig(makeInfo({ brandLogo: { url: 5 } })).brandLogo,
      ).toEqual(DEFAULT_TENANT_UI.brandLogo);
    });
  });

  describe('theme', () => {
    it('takes configured colours and fonts', () => {
      const config = mapPublicTenantInfoToConfig(
        makeInfo({
          theme: {
            colors: { primary: '#112233', secondary: '#445566', tertiary: '#778899', neutral: '#aabbcc' },
            fontFamily: { headline: 'Playfair', body: 'Inter', label: 'Inter' },
          },
        }),
      );

      expect(config.theme.colors).toEqual({
        primary: '#112233',
        secondary: '#445566',
        tertiary: '#778899',
        neutral: '#aabbcc',
      });
      expect(config.theme.fontFamily).toEqual({ headline: 'Playfair', body: 'Inter', label: 'Inter' });
    });

    it('fills missing roles from the defaults', () => {
      const config = mapPublicTenantInfoToConfig(
        makeInfo({ theme: { colors: { primary: '#112233' } } }),
      );

      expect(config.theme.colors.primary).toBe('#112233');
      expect(config.theme.colors.secondary).toBe(DEFAULT_TENANT_UI.theme.colors.secondary);
      expect(config.theme.fontFamily).toEqual(DEFAULT_TENANT_UI.theme.fontFamily);
    });

    it('ignores values that are not strings', () => {
      const config = mapPublicTenantInfoToConfig(
        makeInfo({
          theme: { colors: { primary: 123, secondary: null }, fontFamily: { body: 7 } },
        }),
      );

      expect(config.theme.colors.primary).toBe(DEFAULT_TENANT_UI.theme.colors.primary);
      expect(config.theme.colors.secondary).toBe(DEFAULT_TENANT_UI.theme.colors.secondary);
      expect(config.theme.fontFamily.body).toBe(DEFAULT_TENANT_UI.theme.fontFamily.body);
    });

    it('does not mutate the shared defaults', () => {
      mapPublicTenantInfoToConfig(makeInfo({ theme: { colors: { primary: '#000000' } } }));

      expect(DEFAULT_TENANT_UI.theme.colors.primary).toBe('#D4AF37');
    });

    it('does not add roles the app does not know about', () => {
      const config = mapPublicTenantInfoToConfig(
        makeInfo({ theme: { colors: { primary: '#112233', danger: '#ff0000' } } }),
      );

      expect(Object.keys(config.theme.colors).sort()).toEqual([
        'neutral',
        'primary',
        'secondary',
        'tertiary',
      ]);
    });
  });

  describe('active modules', () => {
    it('applies configured switches over the defaults', () => {
      const config = mapPublicTenantInfoToConfig(
        makeInfo({ activeModules: { trading: false, ecommerce: false } }),
      );

      expect(config.activeModules).toEqual({
        home: true,
        trading: false,
        vault: true,
        ecommerce: false,
      });
    });

    it('ignores switches that are not booleans', () => {
      const config = mapPublicTenantInfoToConfig(
        makeInfo({ activeModules: { trading: 'no', vault: 0 } }),
      );

      expect(config.activeModules.trading).toBe(true);
      expect(config.activeModules.vault).toBe(true);
    });

    it('does not mutate the shared defaults', () => {
      mapPublicTenantInfoToConfig(makeInfo({ activeModules: { trading: false } }));

      expect(DEFAULT_TENANT_UI.activeModules.trading).toBe(true);
    });
  });
});
