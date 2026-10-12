import { applyTenantTheme } from './applyTenantTheme';
import { DEFAULT_TENANT_CONFIG } from './tenant.defaults';
import { computeTenantCssVars } from './tenantCssVars';
import type { TenantConfig } from './tenant.types';

const root = () => document.documentElement;

describe('applyTenantTheme', () => {
  beforeEach(() => root().removeAttribute('style'));

  it('writes every theme variable onto the document root', () => {
    applyTenantTheme(DEFAULT_TENANT_CONFIG);

    for (const [name, value] of computeTenantCssVars(DEFAULT_TENANT_CONFIG)) {
      expect(root().style.getPropertyValue(name)).toBe(value);
    }
  });

  it('replaces the previous tenant colours when applied again', () => {
    applyTenantTheme(DEFAULT_TENANT_CONFIG);
    const next: TenantConfig = {
      ...DEFAULT_TENANT_CONFIG,
      theme: {
        ...DEFAULT_TENANT_CONFIG.theme,
        colors: { ...DEFAULT_TENANT_CONFIG.theme.colors, primary: '#0000ff' },
        fontFamily: { headline: 'Playfair', body: 'Inter', label: 'Inter' },
      },
    };

    applyTenantTheme(next);

    expect(root().style.getPropertyValue('--brand-primary')).toBe('#0000ff');
    expect(root().style.getPropertyValue('--font-headline')).toBe('Playfair');
  });

  it('leaves unrelated styles on the root alone', () => {
    root().style.setProperty('--something-else', 'keep');

    applyTenantTheme(DEFAULT_TENANT_CONFIG);

    expect(root().style.getPropertyValue('--something-else')).toBe('keep');
  });
});
