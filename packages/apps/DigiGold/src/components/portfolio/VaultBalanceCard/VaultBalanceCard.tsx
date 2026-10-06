'use client';

import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { CoinsIcon, WalletIcon } from '@/components/common/icons/Icons';
import { MARKET_PURITY_LABEL } from '@/features/market/market.types';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  GRAMS_PRECISION,
  PORTFOLIO_REFETCH_INTERVAL_MS,
} from '@/features/portfolio/portfolio.types';
import type { Portfolio } from '@/features/portfolio/portfolio.types';
import { ROUTES } from '@/lib/constants/routes';
import styles from './VaultBalanceCard.module.scss';

type VaultBalanceCardProps = {
  portfolio: Portfolio;
};

export function VaultBalanceCard({ portfolio }: VaultBalanceCardProps) {
  const { balanceGrams, currentValuationInr } = portfolio;
  const hasHolding = balanceGrams > 0;
  const valuationUnavailable =
    hasHolding && portfolio.liveRate.bid === null && currentValuationInr === 0;

  return (
    <Card className={styles.card}>
      <div className={styles.topRow}>
        <p className={styles.label}>Total Vault Value</p>
        <Badge variant="brand">{MARKET_PURITY_LABEL}</Badge>
      </div>

      {/* Keep the server's valuation and show its own timestamp; market ticks update
          the separate bid/ask panel without recalculating customers' holdings. */}
      <p className={styles.valuation}>
        {valuationUnavailable
          ? 'Valuation unavailable'
          : formatCurrency(currentValuationInr, 'INR')}
      </p>

      <div className={styles.balanceRow}>
        <WalletIcon width={16} height={16} />
        <span className={styles.balance}>
          {balanceGrams.toFixed(GRAMS_PRECISION)} g
        </span>
        <span className={styles.balanceUnit}>
          {hasHolding
            ? 'held in your vault'
            : '— start your first purchase today'}
        </span>
      </div>

      <p className={styles.hint}>
        {valuationUnavailable
          ? 'Your gold balance is confirmed. A valuation will be available when the bid rate returns.'
          : `Last confirmed valuation at the bid rate. Refreshes every ${PORTFOLIO_REFETCH_INTERVAL_MS / 1000} seconds.`}{' '}
        Holdings updated{' '}
        <time dateTime={portfolio.fetchedAt}>
          {new Date(portfolio.fetchedAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </time>
        .
      </p>

      <div className={styles.actions}>
        <Link href={ROUTES.home} className={styles.primaryAction}>
          <CoinsIcon width={16} height={16} />
          {hasHolding ? 'Buy More Gold' : 'Buy Gold'}
        </Link>
      </div>
    </Card>
  );
}
