import { DEFAULT_TENANT_UI } from './tenant.defaults';
import type { PublicTenantInfo, TenantConfig, TenantColorRole } from './tenant.types';

// ui_json_config is arbitrary JSONB — it may be an array (layout data), a string, or null,
// so only a plain object is read as config.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// Theme colors are written straight into CSS custom properties, so anything that isn't a
// plain hex color falls back to the default rather than reaching the stylesheet.
function hexColor(value: unknown): string | null {
  const color = text(value);
  return color && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color) ? color : null;
}

// A tenant without a logo gets its own name as text (Logo's fallback) — never the default
// DigiGold artwork, which would brand a real tenant as someone else.
function pickBrandLogo(uiConfig: unknown, displayName: string): TenantConfig['brandLogo'] {
  const raw = isRecord(uiConfig) ? uiConfig['brandLogo'] : undefined;
  if (!isRecord(raw)) return { url: '', alt: displayName };
  return { url: text(raw.url) ?? '', alt: text(raw.alt) ?? displayName };
}

function pickTheme(uiConfig: unknown): TenantConfig['theme'] {
  const raw = isRecord(uiConfig) ? uiConfig['theme'] : undefined;
  if (!isRecord(raw)) return DEFAULT_TENANT_UI.theme;

  const rawColors = isRecord(raw.colors) ? raw.colors : {};
  const colors = { ...DEFAULT_TENANT_UI.theme.colors };
  (Object.keys(colors) as TenantColorRole[]).forEach((role) => {
    colors[role] = hexColor(rawColors[role]) ?? colors[role];
  });

  const rawFontFamily = isRecord(raw.fontFamily) ? raw.fontFamily : {};
  const fontFamily = { ...DEFAULT_TENANT_UI.theme.fontFamily };
  (Object.keys(fontFamily) as (keyof typeof fontFamily)[]).forEach((key) => {
    fontFamily[key] = text(rawFontFamily[key]) ?? fontFamily[key];
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
  // Without an identity every tenant-scoped request would be ambiguous — fail loudly so
  // Providers keeps the neutral default instead of half-applying this response.
  const tenantId = text(info.tenant_uuid);
  if (!tenantId) throw new Error('Tenant API returned an invalid tenant identity.');

  const displayName = text(info.full_name) ?? text(info.short_name) ?? 'DigiGold';

  return {
    tenantId,
    displayName,
    shortName: info.short_name,
    domain: info.domain,
    subdomain: info.subdomain,
    kycMode: info.kyc_mode,
    brandLogo: pickBrandLogo(info.ui_json_config, displayName),
    theme: pickTheme(info.ui_json_config),
    activeModules: pickActiveModules(info.ui_json_config),
  };
}
