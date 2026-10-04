import type { TenantConfig } from './tenant.types';

// Generic, brand-neutral fallback. Used only when `/tenant/info` is unreachable (e.g. a
// server-side render before MainServer is up) or a tenant's ui_json_config is missing
// fields — never as a stand-in for real tenant data on the happy path.
export const DEFAULT_TENANT_UI: Pick<TenantConfig, 'brandLogo' | 'theme' | 'activeModules'> = {
  brandLogo: { url: '/brand/logo.svg', alt: 'DigiGold' },
  theme: {
    colors: {
      primary: '#D4AF37',
      secondary: '#1A1A1A',
      tertiary: '#C5A028',
      neutral: '#F8F9FA',
    },
    fontFamily: {
      headline: 'Hanken Grotesk',
      body: 'Hanken Grotesk',
      label: 'Hanken Grotesk',
    },
  },
  activeModules: {
    home: true,
    trading: true,
    vault: true,
    ecommerce: true,
  },
};

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  tenantId: '',
  displayName: 'DigiGold',
  shortName: null,
  domain: null,
  subdomain: null,
  kycMode: 'just_in_time',
  ...DEFAULT_TENANT_UI,
};
