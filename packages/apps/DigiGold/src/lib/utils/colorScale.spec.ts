import { generateColorScale } from './colorScale';

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

describe('generateColorScale', () => {
  const baseHex = '#D4AF37';
  const scale = generateColorScale(baseHex);

  it('lands the base hex exactly at step 500', () => {
    expect(scale[500]).toBe(baseHex.toLowerCase());
  });

  it('produces valid hex output for every step', () => {
    Object.values(scale).forEach((hex) => {
      expect(hex).toMatch(HEX_PATTERN);
    });
  });

  it('lightens steps below 500', () => {
    expect(scale[50]).not.toBe(baseHex);
    expect(scale[400]).not.toBe(baseHex);
  });

  it('darkens steps above 500', () => {
    expect(scale[600]).not.toBe(baseHex);
    expect(scale[900]).not.toBe(baseHex);
  });
});
