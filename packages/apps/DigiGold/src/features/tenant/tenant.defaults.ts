import type { TenantConfig } from './tenant.types';

// Static presentation used before tenant metadata loads and for omitted theme settings.
// Live tenant identity and configured branding are resolved by tenant.service.ts.
export const defaultTenantConfig: TenantConfig = {
  tenantId: 'aurelian-digital',
  displayName: 'Aurelian Digital',
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
