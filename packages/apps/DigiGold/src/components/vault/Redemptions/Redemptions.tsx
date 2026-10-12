'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { VaultUnavailableState } from '@/components/portfolio/VaultStates/VaultStates';
import { useSessionGate } from '@/features/auth/hooks/useSessionGate';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { ROUTES } from '@/lib/constants/routes';
import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio';
import { RedeemFlow } from './RedeemFlow';
import { RedemptionList } from './RedemptionList';
import styles from './Redemptions.module.scss';

export function Redemptions() {
  const router = useRouter();
  const tenantConfig = useTenantConfig();
  const { isReady } = useSessionGate();
  // Shared portfolio hook: enabled only for an authenticated session, and returns the
  // already-normalised Portfolio (balanceGrams), or null on failure.
  const { portfolio, isLoading, isFetching, refetch, isMock } = usePortfolio();

  if (tenantConfig && !tenantConfig.activeModules.vault) {
    return <VaultUnavailableState onGoHome={() => router.push(ROUTES.home)} />;
  }

  if (!isReady || (!portfolio && isLoading)) {
    return (
      <div className={styles.stateRow}>
        <Loader label="Loading your vault" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className={styles.stateRow}>
        <p className={styles.message}>Couldn&apos;t load your vault balance.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refetch()}
          isLoading={isFetching}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      {/* The cards carry their own visible titles; the page heading is for screen readers
          and document outline only. */}
      <h1 className={styles.pageTitle}>Redeem gold</h1>
      <div className={styles.layout}>
        <aside className={styles.flowPane}>
          {/* In mock-portfolio mode the balance is simulated, but /trade/redeem debits the
              real vault — offering the form would let the demo figure drive a real debit. */}
          {isMock ? (
            <p className={styles.message} role="note">
              Redemption is unavailable while the vault shows demo data.
            </p>
          ) : (
            <RedeemFlow balanceGrams={portfolio.balanceGrams} />
          )}
        </aside>
        <div className={styles.listPane}>
          <RedemptionList />
        </div>
      </div>
    </section>
  );
}
