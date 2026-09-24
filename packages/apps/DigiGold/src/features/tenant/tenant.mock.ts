import type { TenantConfig } from './tenant.types';

// All retailer codes resolve to this single mock until MainServer's tenant config
// endpoint is ready — see tenant.service.ts's USE_MOCK_TENANT_CONFIG flag.
export const mockTenantConfig: TenantConfig = {
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
