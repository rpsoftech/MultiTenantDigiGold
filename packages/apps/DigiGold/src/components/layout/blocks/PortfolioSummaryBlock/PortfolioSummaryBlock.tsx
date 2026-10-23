'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card/Card';
import { Loader, Skeleton } from '@/components/common/Loader/Loader';
import { VaultBalanceCard } from '@/components/portfolio/VaultBalanceCard/VaultBalanceCard';
import {
  VaultErrorState,
  VaultUnauthenticatedState,
} from '@/components/portfolio/VaultStates/VaultStates';
import { useSessionResolved } from '@/features/auth/hooks/useSessionResolved';
import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { ROUTES } from '@/lib/constants/routes';
import { useBuyAction } from '../../useBuyAction';
import styles from './PortfolioSummaryBlock.module.scss';

function PortfolioSkeleton() {
  return (
    <Card className={styles.skeleton}>
      <span className={styles.status}>
        <Loader size="sm" label="Loading your portfolio" />
        Loading your portfolio
      </span>
      <Skeleton width="40%" height="0.8125rem" />
      <Skeleton width="70%" height="2.25rem" />
      <Skeleton width="45%" height="1.125rem" />
    </Card>
  );
}

export function PortfolioSummaryBlock() {
  const headingId = useId();
  const router = useRouter();
  const vaultEnabled = useTenantConfig()?.activeModules.vault ?? true;
  const sessionResolved = useSessionResolved();
  const { canBuy, startBuy, buyDialog } = useBuyAction();
  const { portfolio, isLoading, isFetching, isAuthenticated, error, isMock, refetch } =
    usePortfolio();

  // A tenant without the vault has no portfolio to summarise.
  if (!vaultEnabled) return null;

  const renderContent = () => {
    // Until mount effects run, a signed-in customer's session is not restored yet; showing
    // "sign in" now would flash at them on every refresh.
    if (!isAuthenticated && !sessionResolved) return <PortfolioSkeleton />;
    if (!isAuthenticated) {
      return <VaultUnauthenticatedState onSignIn={() => router.push(ROUTES.login)} />;
    }
    if (portfolio) {
      return <VaultBalanceCard portfolio={portfolio} onBuy={canBuy ? startBuy : undefined} />;
    }
    if (isLoading) return <PortfolioSkeleton />;
    return (
      <VaultErrorState message={error} isRetrying={isFetching} onRetry={() => void refetch()} />
    );
  };

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        My portfolio
      </h2>
      {isMock && isAuthenticated && (
        <p className={styles.demoNotice}>Demo data. These holdings and prices are simulated.</p>
      )}
      {renderContent()}
      {buyDialog}
    </section>
  );
}
