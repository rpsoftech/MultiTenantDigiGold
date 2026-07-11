import { lighten, darken, toHex } from 'color2k';

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type ColorScale = Record<(typeof STEPS)[number], string>;

// 500 is treated as the base color the tenant configured; steps below lighten
// toward neutral, steps above darken toward near-black.
export function generateColorScale(baseHex: string): ColorScale {
  const scale = {} as ColorScale;
  STEPS.forEach((step) => {
    if (step === 500) return void (scale[step] = toHex(baseHex));
    const distanceFromBase = (500 - step) / 500;
    scale[step] = toHex(
      step < 500
        ? lighten(baseHex, distanceFromBase * 0.9)
        : darken(baseHex, Math.abs(distanceFromBase) * 0.9)
    );
  });
  return scale;
}
