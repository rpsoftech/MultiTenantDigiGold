'use client';

import { useId } from 'react';
import { Badge } from '@/components/common/Badge/Badge';
import { Card } from '@/components/common/Card/Card';
import { Skeleton } from '@/components/common/Loader/Loader';
import { useLiveRate } from '@/features/market/hooks/useLiveRate';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import styles from './LiveRateBlock.module.scss';

function RateTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={styles.tile}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>
        {value === null ? (
          <span className={styles.unavailable}>Unavailable</span>
        ) : (
          <>
            {formatCurrency(value, 'INR', 2)}
            <span className={styles.unit}>/g</span>
          </>
        )}
      </dd>
    </div>
  );
}

export function LiveRateBlock() {
  const headingId = useId();
  const { data: rate, isLoading, isConnected } = useLiveRate();
  const hasRate = rate !== null && (rate.pricePerGramInr > 0 || rate.bidPerGramInr !== null);

  return (
    <section aria-labelledby={headingId}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2 id={headingId} className={styles.title}>
              Live gold rate
            </h2>
            <p className={styles.purity}>{rate?.purityLabel ?? '24K • 99.99%'}</p>
          </div>
          {hasRate &&
            (isConnected ? (
              <Badge variant="success">Live</Badge>
            ) : (
              <Badge variant="neutral">Snapshot</Badge>
            ))}
        </div>

        {isLoading ? (
          <div className={styles.skeletons} role="status" aria-label="Loading live rate">
            <Skeleton width="100%" height="3rem" />
            <Skeleton width="100%" height="3rem" />
          </div>
        ) : !hasRate ? (
          <p className={styles.notice} role="status">
            The live rate is unavailable right now. It will appear here as soon as the feed
            returns.
          </p>
        ) : (
          <>
            <dl className={styles.tiles}>
              <RateTile label="Buy price" value={rate.pricePerGramInr} />
              <RateTile label="Sell price" value={rate.bidPerGramInr} />
            </dl>
            <p className={styles.footnote}>
              Indicative rates per gram. The final price is confirmed before you pay.
            </p>
          </>
        )}
      </Card>
    </section>
  );
}
