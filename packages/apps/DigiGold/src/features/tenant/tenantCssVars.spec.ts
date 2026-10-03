import { generateColorScale } from '@/lib/utils/colorScale';
import { DEFAULT_TENANT_CONFIG } from './tenant.defaults';
import { computeTenantCssVars } from './tenantCssVars';
import type { TenantConfig } from './tenant.types';

const asMap = (config: TenantConfig) => new Map(computeTenantCssVars(config));

describe('computeTenantCssVars', () => {
  it('produces a ten step scale for every colour role', () => {
    const vars = asMap(DEFAULT_TENANT_CONFIG);

    for (const role of ['primary', 'secondary', 'tertiary', 'neutral']) {
      for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
        expect(vars.has(`--color-${role}-${step}`)).toBe(true);
      }
    }
  });

  it('derives each scale from the configured base colour', () => {
    const vars = asMap(DEFAULT_TENANT_CONFIG);
    const expected = generateColorScale(DEFAULT_TENANT_CONFIG.theme.colors.primary);

    expect(vars.get('--color-primary-300')).toBe(expected[300]);
    expect(vars.get('--color-primary-700')).toBe(expected[700]);
  });

  it('exposes the base colour of each role as its brand variable', () => {
    const vars = asMap(DEFAULT_TENANT_CONFIG);

    expect(vars.get('--brand-primary')).toBe(vars.get('--color-primary-500'));
    expect(vars.get('--brand-secondary')).toBe(vars.get('--color-secondary-500'));
    expect(vars.get('--brand-tertiary')).toBe(vars.get('--color-tertiary-500'));
    expect(vars.get('--brand-neutral')).toBe(vars.get('--color-neutral-500'));
  });

  it('exposes the three font families', () => {
    const config: TenantConfig = {
      ...DEFAULT_TENANT_CONFIG,
      theme: {
        ...DEFAULT_TENANT_CONFIG.theme,
        fontFamily: { headline: 'Playfair', body: 'Inter', label: 'Roboto' },
      },
    };
    const vars = asMap(config);

    expect(vars.get('--font-headline')).toBe('Playfair');
    expect(vars.get('--font-body')).toBe('Inter');
    expect(vars.get('--font-label')).toBe('Roboto');
  });

  it('reflects a different brand colour', () => {
    const config: TenantConfig = {
      ...DEFAULT_TENANT_CONFIG,
      theme: {
        ...DEFAULT_TENANT_CONFIG.theme,
        colors: { ...DEFAULT_TENANT_CONFIG.theme.colors, primary: '#0000ff' },
      },
    };

    expect(asMap(config).get('--brand-primary')).toBe('#0000ff');
  });

  it('returns 47 variables: 4 roles x 11, plus 3 fonts', () => {
    expect(computeTenantCssVars(DEFAULT_TENANT_CONFIG)).toHaveLength(47);
  });
});
