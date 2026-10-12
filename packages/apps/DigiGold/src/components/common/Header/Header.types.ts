import type { IconKey } from '@/components/common/icons/iconRegistry';
import type { TenantConfig } from '@/features/tenant/tenant.types';

export type NavIconKey = IconKey;

export type MenuTarget = '_self' | '_blank';

export type MenuItem = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  order: number;
  icon?: NavIconKey;
  target?: MenuTarget;
  // Hidden when the tenant has this module switched off in activeModules.
  module?: keyof TenantConfig['activeModules'];
  children?: MenuItem[];
};

export type HeaderActionType = 'link' | 'button';

export type HeaderAction = {
  id: string;
  label: string;
  url: string;
  type: HeaderActionType;
  enabled: boolean;
  order: number;
  target?: MenuTarget;
  icon?: NavIconKey;
};

export type HeaderLogoConfig = {
  text?: string;
  image?: string;
  url: string;
};

export type HeaderConfig = {
  logo: HeaderLogoConfig;
  menus: MenuItem[];
  actions: HeaderAction[];
};
