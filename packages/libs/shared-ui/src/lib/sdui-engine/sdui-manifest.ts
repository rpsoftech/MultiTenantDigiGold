import { Type } from '@angular/core';

export const SDUI_MANIFEST: Record<string, () => Promise<Type<any>>> = {
  Hero_1: () =>
    import('../components/hero/hero-1.component').then((m) => m.Hero1Component),
  LiveRate_1: () =>
    import('../components/rates/live-rate.component').then(
      (m) => m.LiveRateComponent,
    ),
};
