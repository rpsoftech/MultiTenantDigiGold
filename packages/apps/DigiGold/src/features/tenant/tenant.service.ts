import { apiClient } from '@/lib/api/client';
import type { TenantConfig } from './tenant.types';
import { mockTenantConfig } from './tenant.mock';

type TenantInfo = {
  tenant_uuid: string;
  full_name: string;
  short_name?: string | null;
  ui_json_config?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function colorOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' &&
    /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)
    ? value
    : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export async function resolveTenantConfig(
  retailerCode: string,
): Promise<TenantConfig> {
  if (process.env.NEXT_PUBLIC_USE_MOCK_TENANT_CONFIG === 'true') {
    return mockTenantConfig;
  }

  // MainServer resolves the tenant through X-Tenant-ID (set by apiClient) or Host.
  // This endpoint returns a flat public tenant object, without an API envelope.
  const { data } = await apiClient.get<TenantInfo>('/tenant/info');
  if (!stringOrDefault(data?.tenant_uuid, '')) {
    throw new Error('The server returned an invalid tenant configuration.');
  }

  // ui_json_config may contain a server-driven layout array. Use this app's
  // visual defaults when no branding/theme object has been configured yet.
  const ui = asRecord(data.ui_json_config);
  const logo = asRecord(ui.brandLogo);
  const theme = asRecord(ui.theme);
  const colors = asRecord(theme.colors);
  const fonts = asRecord(theme.fontFamily);
  const modules = asRecord(ui.activeModules);
  const defaults = mockTenantConfig;
  const displayName = stringOrDefault(
    ui.displayName,
    stringOrDefault(
      data.full_name,
      stringOrDefault(data.short_name, retailerCode),
    ),
  );

  return {
    tenantId: data.tenant_uuid,
    displayName,
    brandLogo: {
      // An unconfigured tenant uses its own name as a text logo.
      url: stringOrDefault(logo.url, ''),
      alt: stringOrDefault(logo.alt, displayName),
    },
    theme: {
      colors: {
        primary: colorOrDefault(colors.primary, defaults.theme.colors.primary),
        secondary: colorOrDefault(
          colors.secondary,
          defaults.theme.colors.secondary,
        ),
        tertiary: colorOrDefault(
          colors.tertiary,
          defaults.theme.colors.tertiary,
        ),
        neutral: colorOrDefault(colors.neutral, defaults.theme.colors.neutral),
      },
      fontFamily: {
        headline: stringOrDefault(
          fonts.headline,
          defaults.theme.fontFamily.headline,
        ),
        body: stringOrDefault(fonts.body, defaults.theme.fontFamily.body),
        label: stringOrDefault(fonts.label, defaults.theme.fontFamily.label),
      },
    },
    activeModules: {
      home: booleanOrDefault(modules.home, defaults.activeModules.home),
      trading: booleanOrDefault(
        modules.trading,
        defaults.activeModules.trading,
      ),
      vault: booleanOrDefault(modules.vault, defaults.activeModules.vault),
      ecommerce: booleanOrDefault(
        modules.ecommerce,
        defaults.activeModules.ecommerce,
      ),
    },
  };
}
