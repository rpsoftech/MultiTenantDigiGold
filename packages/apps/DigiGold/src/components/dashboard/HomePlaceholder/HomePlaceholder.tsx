'use client';

import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useSession } from '@/features/auth/hooks/useSession';
import styles from './HomePlaceholder.module.scss';

// Stands in for the real Home Dashboard (hero header, promo carousel, live ticker,
// bottom nav) — Phase 1 build-order item 5, not built yet. This just confirms the auth
// flow landed somewhere valid.
export function HomePlaceholder() {
  const tenantConfig = useTenantConfig();
  const { user } = useSession();

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Welcome{user ? `, ${user.mobileNumber}` : ''}</h1>
      <p className={styles.subtitle}>
        You&apos;re signed in to {tenantConfig?.displayName ?? 'DigiGold'}. The Home Dashboard
        lands in the next Phase 1 step.
      </p>
    </div>
  );
}
