import { Type } from '@angular/core';

export const SDUI_MANIFEST: Record<string, () => Promise<Type<any>>> = {
  Hero_1: () =>
    import('../components/hero/hero-1.component').then((m) => m.Hero1Component),
  LiveRate_1: () =>
    import('../components/rates/live-rate.component').then(
      (m) => m.LiveRateComponent,
    ),
  Header_1: () =>
    import('../components/navigation/header-1.component').then(
      (m) => m.Header1Component,
    ),
  QuickActions_1: () =>
    import('../components/actions/quick-actions-1.component').then(
      (m) => m.QuickActions1Component,
    ),
  PortfolioSummary_1: () =>
    import('../components/portfolio/portfolio-summary-1.component').then(
      (m) => m.PortfolioSummary1Component,
    ),
};
