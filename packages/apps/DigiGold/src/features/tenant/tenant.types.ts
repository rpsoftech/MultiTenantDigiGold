// NOTE: candidate for @digigold/core — MainServer will need to validate/serve this same
// shape once its tenant config endpoint exists; move it there instead of duplicating once
// packages/libs/core is built and importable.

export type TenantColorRole = 'primary' | 'secondary' | 'tertiary' | 'neutral';

export type TenantConfig = {
  tenantId: string;
  displayName: string;
  brandLogo: { url: string; alt: string };
  theme: {
    colors: Record<TenantColorRole, string>; // base hex only, per role
    fontFamily: {
      headline: string;
      body: string;
      label: string;
    };
  };
  activeModules: {
    home: boolean;
    trading: boolean;
    vault: boolean;
    ecommerce: boolean;
  };
};
