'use client';

import { useModuleShown } from '@/features/tenant/hooks/useModuleShown';
import { useDashboardEssentialsConfig } from './useDashboardEssentialsConfig';
import { EssentialCard } from './EssentialCard';
import styles from './DashboardEssentials.module.scss';

export function DashboardEssentials() {
  const moduleShown = useModuleShown();
  const { title, items } = useDashboardEssentialsConfig();

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
