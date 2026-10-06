import type { TenantConfig } from './tenant.types';

// Fixture for tests only — not imported by any real code path. See tenant.service.ts
// for the real GET /tenant/info call.
export const mockTenantConfig: TenantConfig = {
  tenantId: 'aurelian-digital',
  displayName: 'Aurelian Digital',
  shortName: 'aurelian-digital',
  domain: null,
  subdomain: 'aurelian-digital',
  kycMode: 'just_in_time',
  brandLogo: {
    url: '/brand/logo.svg',
    alt: 'Aurelian Digital',
  },
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
