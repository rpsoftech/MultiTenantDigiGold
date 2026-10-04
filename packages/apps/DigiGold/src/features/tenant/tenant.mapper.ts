import { DEFAULT_TENANT_UI } from './tenant.defaults';
import type { PublicTenantInfo, TenantConfig, TenantColorRole } from './tenant.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickBrandLogo(uiConfig: unknown): TenantConfig['brandLogo'] {
  const raw = isRecord(uiConfig) ? uiConfig['brandLogo'] : undefined;
  if (!isRecord(raw) || typeof raw.url !== 'string') return DEFAULT_TENANT_UI.brandLogo;
  return { url: raw.url, alt: typeof raw.alt === 'string' ? raw.alt : '' };
}

function pickTheme(uiConfig: unknown): TenantConfig['theme'] {
  const raw = isRecord(uiConfig) ? uiConfig['theme'] : undefined;
  if (!isRecord(raw)) return DEFAULT_TENANT_UI.theme;

  const rawColors = isRecord(raw.colors) ? raw.colors : {};
  const colors = { ...DEFAULT_TENANT_UI.theme.colors };
  (Object.keys(colors) as TenantColorRole[]).forEach((role) => {
    const value = rawColors[role];
    if (typeof value === 'string') colors[role] = value;
  });

  const rawFontFamily = isRecord(raw.fontFamily) ? raw.fontFamily : {};
  const fontFamily = { ...DEFAULT_TENANT_UI.theme.fontFamily };
  (Object.keys(fontFamily) as (keyof typeof fontFamily)[]).forEach((key) => {
    const value = rawFontFamily[key];
    if (typeof value === 'string') fontFamily[key] = value;
  });

  return { colors, fontFamily };
}

function pickActiveModules(uiConfig: unknown): TenantConfig['activeModules'] {
  const raw = isRecord(uiConfig) ? uiConfig['activeModules'] : undefined;
  const modules = { ...DEFAULT_TENANT_UI.activeModules };
  if (!isRecord(raw)) return modules;

  (Object.keys(modules) as (keyof typeof modules)[]).forEach((key) => {
    const value = raw[key];
    if (typeof value === 'boolean') modules[key] = value;
  });
  return modules;
}

export function mapPublicTenantInfoToConfig(info: PublicTenantInfo): TenantConfig {
  return {
    tenantId: info.tenant_uuid,
    displayName: info.full_name,
    shortName: info.short_name,
    domain: info.domain,
    subdomain: info.subdomain,
    kycMode: info.kyc_mode,
    brandLogo: pickBrandLogo(info.ui_json_config),
    theme: pickTheme(info.ui_json_config),
    activeModules: pickActiveModules(info.ui_json_config),
  };
}
