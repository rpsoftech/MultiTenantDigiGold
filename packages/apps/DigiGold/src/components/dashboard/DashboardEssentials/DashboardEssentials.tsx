'use client';

import { useModuleShown } from '@/features/tenant/hooks/useModuleShown';
import type { DashboardEssentialsProps } from '@/features/layout/layout.sections';
import { useDashboardEssentialsConfig } from './useDashboardEssentialsConfig';
import { EssentialCard } from './EssentialCard';
import styles from './DashboardEssentials.module.scss';

// Title and cards normally come from the frontend config; a published layout block can
// supply the tenant's own. Cards tied to a module the tenant switched off stay hidden.
export function DashboardEssentials({
  title: titleOverride,
  items: itemsOverride,
}: DashboardEssentialsProps = {}) {
  const moduleShown = useModuleShown();
  const config = useDashboardEssentialsConfig();
  const title = titleOverride ?? config.title;
  const items = itemsOverride ?? config.items;

  const visibleItems = items.filter((item) => moduleShown(item.module));

  if (!visibleItems.length) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      <div className={styles.grid}>
        {visibleItems.map((item) => (
          <EssentialCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
