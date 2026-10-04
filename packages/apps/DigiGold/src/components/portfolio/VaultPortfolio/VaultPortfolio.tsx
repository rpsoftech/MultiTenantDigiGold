'use client';

import { useRouter } from 'next/navigation';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useLiveRate } from '@/features/market/hooks/useLiveRate';
import type { MarketRate } from '@/features/market/market.types';
import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio';
import { useSessionResolved } from '@/features/auth/hooks/useSessionResolved';
import type { Portfolio } from '@/features/portfolio/portfolio.types';
import { Button } from '@/components/common/Button/Button';
import { ROUTES } from '@/lib/constants/routes';
import { VaultBalanceCard } from '@/components/portfolio/VaultBalanceCard/VaultBalanceCard';
import { LiveRatePanel } from '@/components/portfolio/LiveRatePanel/LiveRatePanel';
import {
  VaultErrorState,
  VaultLoadingState,
  VaultUnauthenticatedState,
  VaultUnavailableState,
} from '@/components/portfolio/VaultStates/VaultStates';
import styles from './VaultPortfolio.module.scss';

// The two-column split lives here rather than on .section so the loading/error/sign-in
// states can each span the full width instead of being squeezed into a column.
function VaultHoldings({
  portfolio,
  marketRate,
  isStreamConnected,
}: {
  portfolio: Portfolio;
  marketRate: MarketRate | null;
  isStreamConnected: boolean;
}) {
  // A cached market quote may predate this portfolio snapshot. Keep whichever prices
  // were received most recently; an open connection alone does not make a quote live.
  const hasNewerQuote =
    marketRate !== null &&
    (marketRate.bidPerGramInr != null || marketRate.askPerGramInr != null) &&
    Date.parse(marketRate.updatedAt) >= Date.parse(portfolio.fetchedAt);
  const liveRate = hasNewerQuote
    ? {
        ...portfolio.liveRate,
        bid: marketRate.bidPerGramInr ?? null,
        ask: marketRate.askPerGramInr ?? null,
      }
    : portfolio.liveRate;

  return (
    <div className={styles.grid}>
      <VaultBalanceCard portfolio={portfolio} />
      <LiveRatePanel
        liveRate={liveRate}
        balanceGrams={portfolio.balanceGrams}
        isStreamConnected={isStreamConnected && hasNewerQuote}
        fetchedAt={hasNewerQuote ? marketRate.updatedAt : portfolio.fetchedAt}
      />
    </div>
  );
}

export function VaultPortfolio() {
  const router = useRouter();
  const tenantConfig = useTenantConfig();
  // Subscribed here (not inside the rate panel) so the SSE lifecycle is owned in one place
  // and shared with every other consumer via market.sse.ts's ref-counted singleton.
  const { data: marketRate, isConnected: isStreamConnected } = useLiveRate();
  const {
    portfolio,
    isLoading,
    isFetching,
    error,
    isAuthenticated,
    isMock,
    refetch,
  } = usePortfolio();
  const sessionResolved = useSessionResolved();
  const vaultEnabled = tenantConfig?.activeModules.vault ?? true;

  const renderContent = () => {
    if (!vaultEnabled) {
      return <VaultUnavailableState onGoHome={() => router.push(ROUTES.home)} />;
    }
    // Before mount effects run, a logged-in user's session hasn't been restored yet.
    if (!isAuthenticated && !sessionResolved) return <VaultLoadingState />;
    if (!isAuthenticated) {
      return (
        <VaultUnauthenticatedState onSignIn={() => router.push(ROUTES.login)} />
      );
    }
    // Skeleton only on the very first load — a background refetch keeps the settled card on
    // screen instead of flashing placeholders every 30s.
    if (!portfolio && isLoading) return <VaultLoadingState />;
    if (!portfolio) {
      return (
        <VaultErrorState
          message={error}
          isRetrying={isFetching}
          onRetry={() => void refetch()}
        />
      );
    }

    return (
      <>
        {error && (
          <div className={styles.refreshError} role="alert">
            <p>
              We couldn't refresh your holdings. {error} Showing the last
              confirmed portfolio.
            </p>
            <Button
              variant="outlined"
              aria-label="Retry portfolio refresh"
              onClick={() => void refetch()}
              isLoading={isFetching}
            >
              Try again
            </Button>
          </div>
        )}
        <VaultHoldings
          portfolio={portfolio}
          marketRate={isMock ? null : (marketRate ?? null)}
          isStreamConnected={!isMock && isStreamConnected}
        />
      </>
    );
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>My Vault</h2>
      {isMock && isAuthenticated && (
        <p className={styles.demoNotice}>
          Demo data. These holdings and prices are simulated.
        </p>
      )}
      {renderContent()}
    </section>
  );
}
