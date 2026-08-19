import { generateColorScale } from '@/lib/utils/colorScale';
import type { TenantConfig, TenantColorRole } from './tenant.types';

export type TenantCssVarEntry = [name: string, value: string];

// Single source of truth for turning a TenantConfig into CSS custom property entries.
// applyTenantTheme (client) writes these via element.style.setProperty; the root layout
// (server) joins them into an inline <style> string for SSR — both call this function so
// the two never drift.
export function computeTenantCssVars(config: TenantConfig): TenantCssVarEntry[] {
  const entries: TenantCssVarEntry[] = [];

  (Object.entries(config.theme.colors) as [TenantColorRole, string][]).forEach(
    ([role, baseHex]) => {
      const scale = generateColorScale(baseHex);
      Object.entries(scale).forEach(([step, hex]) => {
        entries.push([`--color-${role}-${step}`, hex]);
      });
      entries.push([`--brand-${role}`, scale[500]]);
    }
  );

  entries.push(['--font-headline', config.theme.fontFamily.headline]);
  entries.push(['--font-body', config.theme.fontFamily.body]);
  entries.push(['--font-label', config.theme.fontFamily.label]);

  return entries;
}
