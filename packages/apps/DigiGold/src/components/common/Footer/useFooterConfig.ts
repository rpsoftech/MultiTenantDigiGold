import { useMemo } from 'react';
import rawFooterConfig from './footer.config.json';
import type { FooterConfig } from './Footer.types';

const footerConfig = rawFooterConfig as FooterConfig;

// Footer columns/links are frontend site config, not tenant business data — editing
// footer.config.json (add/remove/reorder/enable/disable) needs no code change.
export function useFooterConfig(): FooterConfig {
  return useMemo(
    () => ({
      columns: footerConfig.columns
        .filter((column) => column.enabled)
        .sort((a, b) => a.order - b.order)
        .map((column) => ({
          ...column,
          links: column.links.filter((link) => link.enabled).sort((a, b) => a.order - b.order),
        })),
    }),
    []
  );
}
