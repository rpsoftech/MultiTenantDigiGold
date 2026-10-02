import { apiClient } from '@/lib/api/client';
import type { TenantConfig, TenantInfoResponse } from './tenant.types';
import { defaultTenantConfig } from './tenant.defaults';
import { mockTenantConfig } from './tenant.mock';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function colorOr(value: unknown, fallback: string): string {
  const color = textOr(value, '');
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color) ? color : fallback;
}

function flagOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toTenantConfig(
  info: TenantInfoResponse,
  retailerCode: string,
): TenantConfig {
  const tenantId = textOr(info.tenant_uuid, '');
  if (!tenantId)
    throw new Error('Tenant API returned an invalid tenant identity.');

  const displayName = textOr(
    info.full_name,
    textOr(info.short_name, retailerCode),
  );
  const config = asRecord(info.ui_json_config);
  const brandLogo = asRecord(config.brandLogo);
  const theme = asRecord(config.theme);
  const colors = asRecord(theme.colors);
  const fonts = asRecord(theme.fontFamily);
  const modules = asRecord(config.activeModules);
  const defaults = defaultTenantConfig;

  return {
    tenantId,
    displayName,
    // A missing logo renders the real tenant's name, not the default retailer's SVG.
    brandLogo: {
      url: textOr(brandLogo.url, ''),
      alt: textOr(brandLogo.alt, displayName),
    },
    theme: {
      colors: {
        primary: colorOr(colors.primary, defaults.theme.colors.primary),
        secondary: colorOr(colors.secondary, defaults.theme.colors.secondary),
        tertiary: colorOr(colors.tertiary, defaults.theme.colors.tertiary),
        neutral: colorOr(colors.neutral, defaults.theme.colors.neutral),
      },
      fontFamily: {
        headline: textOr(fonts.headline, defaults.theme.fontFamily.headline),
        body: textOr(fonts.body, defaults.theme.fontFamily.body),
        label: textOr(fonts.label, defaults.theme.fontFamily.label),
      },
    },
    activeModules: {
      home: flagOr(modules.home, defaults.activeModules.home),
      trading: flagOr(modules.trading, defaults.activeModules.trading),
      vault: flagOr(modules.vault, defaults.activeModules.vault),
      ecommerce: flagOr(modules.ecommerce, defaults.activeModules.ecommerce),
    },
  };
}

export async function resolveTenantConfig(
  retailerCode: string,
): Promise<TenantConfig> {
  // This service runs in Providers in the browser, where only NEXT_PUBLIC_* env
  // variables are available. A server-only flag silently sent requests to the API.
  if (process.env.NEXT_PUBLIC_USE_MOCK_TENANT_CONFIG === 'true') {
    return mockTenantConfig;
  }

  // The API client sends X-Tenant-ID; MainServer resolves that tenant's public metadata.
  const response = await apiClient.get<TenantInfoResponse>('/tenant/info');
  return toTenantConfig(response.data, retailerCode);
}
