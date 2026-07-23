'use client';

import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useDashboardEssentialsConfig } from './useDashboardEssentialsConfig';
import { EssentialCard } from './EssentialCard';
import styles from './DashboardEssentials.module.scss';

export function DashboardEssentials() {
  const tenantConfig = useTenantConfig();
  const { title, items } = useDashboardEssentialsConfig();

  const visibleItems = items.filter(
    (item) => !item.module || tenantConfig?.activeModules[item.module]
  );

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
