import type { TenantConfig } from '@/features/tenant/tenant.types';

export type EssentialIconKey = 'wallet' | 'coins' | 'gem';

export type EssentialModule = keyof TenantConfig['activeModules'];

export type EssentialItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: EssentialIconKey;
  module?: EssentialModule;
  enabled: boolean;
  order: number;
};

export type DashboardEssentialsConfig = {
  title: string;
  items: EssentialItem[];
};
