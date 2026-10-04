'use client';

import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { ShieldCheckIcon } from '@/components/common/icons/Icons';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils/cn';
import { GRAMS_PRECISION } from '@/features/portfolio/portfolio.types';
import type { LiveRate } from '@/features/portfolio/portfolio.types';
import styles from './LiveRatePanel.module.scss';

type LiveRatePanelProps = {
  liveRate: LiveRate;
  balanceGrams: number;
  // Stream state from the shared market SSE subscription, so the badge distinguishes an
  // actively-fed rate from the last polled snapshot.
  isStreamConnected: boolean;
  fetchedAt: string;
};

function formatFetchedAt(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function LiveRatePanel({
  liveRate,
  balanceGrams,
  isStreamConnected,
  fetchedAt,
}: LiveRatePanelProps) {
  const { bid, ask } = liveRate;
  const spread = bid !== null && ask !== null ? ask - bid : null;
  const hasRate = bid !== null || ask !== null;

  return (
    <Card className={styles.card}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Live Gold Rate</h3>
        {isStreamConnected ? (
          <Badge variant="success">Live</Badge>
        ) : (
          <Badge variant="neutral">Snapshot</Badge>
        )}
      </div>

      <div className={styles.rateList}>
        <div className={styles.rateRow}>
          <span className={styles.rateLabel}>
            Bid
            <span className={styles.rateCaption}> — market sell-side rate</span>
          </span>
          {bid === null ? (
            <span className={styles.rateUnavailable}>Unavailable</span>
          ) : (
            <span className={styles.rateValue}>
              {formatCurrency(bid, 'INR', 2)}
              <span className={styles.rateUnit}>/g</span>
            </span>
          )}
        </div>

        <div className={styles.rateRow}>
          <span className={styles.rateLabel}>
            Ask
            <span className={styles.rateCaption}> — market buy-side rate</span>
          </span>
          {ask === null ? (
            <span className={styles.rateUnavailable}>Unavailable</span>
          ) : (
            <span className={styles.rateValue}>
              {formatCurrency(ask, 'INR', 2)}
              <span className={styles.rateUnit}>/g</span>
            </span>
          )}
        </div>

        {spread !== null && (
          <div className={cn(styles.rateRow, styles.rateRowMuted)}>
            <span>Spread</span>
            <span>{formatCurrency(spread, 'INR', 2)}/g</span>
          </div>
        )}
      </div>

      {/* These are raw MCX quotes. Presenting ask as "what you pay" understated the real
          purchase price by the tenant margin + GST that BuySellGold adds on top. */}
      <p className={styles.footnote}>
        Raw market (MCX) rates. Purchases add your jeweller&apos;s margin and GST on top of
        the ask — the buy screen shows the full price before you pay.
      </p>

      {!hasRate && (
        <p className={styles.footnote}>
          The rate feed is unavailable right now. Your gold balance is still
          shown in your vault.
        </p>
      )}

      <p className={cn(styles.footnote, styles.footnoteWithIcon)}>
        <ShieldCheckIcon width={14} height={14} />
        Portfolio value is computed at the raw bid with no tenant margin applied
        — margin only comes into play when you transact.
      </p>

      <div className={styles.footerRow}>
        <span>
          {balanceGrams > 0
            ? `${balanceGrams.toFixed(GRAMS_PRECISION)} g held`
            : 'No gold held yet'}
        </span>
        <span>
          Rates updated{' '}
          <time dateTime={fetchedAt}>{formatFetchedAt(fetchedAt)}</time>
        </span>
      </div>
    </Card>
  );
}
