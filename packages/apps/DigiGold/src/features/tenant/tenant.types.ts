// Frontend presentation model, adapted from MainServer's public tenant metadata.

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

// GET /api/v1/tenant/info returns public metadata directly, without a data envelope.
// UI configuration is arbitrary JSONB and may contain layout arrays rather than theme data.
export type TenantInfoResponse = {
  tenant_uuid: string;
  full_name: string;
  short_name: string;
  ui_json_config?: unknown;
};
