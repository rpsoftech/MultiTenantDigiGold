// Frontend presentation model, adapted from MainServer's public tenant metadata.
import type { LayoutBlock } from '@/features/layout/layout.types';

export type TenantColorRole = 'primary' | 'secondary' | 'tertiary' | 'neutral';

export type TenantKycMode = 'upfront' | 'just_in_time';

// Raw shape of MainServer's GET /tenant/info response (see
// MainServerGo/internal/api/tenant/tenant_controller.go GetPublicTenantInfo).
// ui_json_config is an opaque, server-driven JSON blob — MainServer does not validate
// its internal shape, so the frontend treats it as unknown and maps it defensively.
export type PublicTenantInfo = {
  tenant_uuid: string;
  full_name: string;
  short_name: string | null;
  domain: string | null;
  subdomain: string | null;
  kyc_mode: TenantKycMode;
  ui_json_config: unknown;
};

export type TenantConfig = {
  tenantId: string;
  displayName: string;
  shortName: string | null;
  domain: string | null;
  subdomain: string | null;
  kycMode: TenantKycMode;
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
  // The tenant's published homepage blocks. null means the server response has not been
  // read yet (the build-time default); [] means it was read and nothing is published.
  layout: LayoutBlock[] | null;
};
