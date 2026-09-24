import { computeTenantCssVars } from './tenantCssVars';
import type { TenantConfig } from './tenant.types';

export function applyTenantTheme(config: TenantConfig): void {
  const root = document.documentElement;
  computeTenantCssVars(config).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}
