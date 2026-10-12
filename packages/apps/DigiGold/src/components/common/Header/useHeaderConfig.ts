import { useMemo } from 'react';
import rawHeaderConfig from './header.config.json';
import type { HeaderAction, HeaderConfig, MenuItem } from './Header.types';

function normalizeMenuItems(items: MenuItem[]): MenuItem[] {
  return items
    .filter((item) => item.enabled)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      ...item,
      children: item.children?.length ? normalizeMenuItems(item.children) : undefined,
    }));
}

function normalizeActions(actions: HeaderAction[]): HeaderAction[] {
  return actions.filter((action) => action.enabled).sort((a, b) => a.order - b.order);
}

const headerConfig = rawHeaderConfig as HeaderConfig;

// Menu structure is frontend site config, not tenant business data — editing
// header.config.json (add/remove/reorder/enable/disable) needs no code change.
export function useHeaderConfig(): HeaderConfig {
  return useMemo(
    () => ({
      logo: headerConfig.logo,
      menus: normalizeMenuItems(headerConfig.menus),
      actions: normalizeActions(headerConfig.actions),
    }),
    []
  );
}
