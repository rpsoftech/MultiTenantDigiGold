import { useMemo } from 'react';
import rawDashboardEssentialsConfig from './dashboard-essentials.config.json';
import type { DashboardEssentialsConfig } from './DashboardEssentials.types';

const dashboardEssentialsConfig = rawDashboardEssentialsConfig as DashboardEssentialsConfig;

// Card copy/order/icons are frontend site config, not tenant business data — editing
// dashboard-essentials.config.json needs no code change. Module-based visibility (per
// tenant activeModules) is applied separately by the consuming component.
export function useDashboardEssentialsConfig(): DashboardEssentialsConfig {
  return useMemo(
    () => ({
      title: dashboardEssentialsConfig.title,
      items: dashboardEssentialsConfig.items
        .filter((item) => item.enabled)
        .sort((a, b) => a.order - b.order),
    }),
    []
  );
}
