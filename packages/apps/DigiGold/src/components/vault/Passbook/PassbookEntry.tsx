import { Badge, type BadgeVariant } from '@/components/common/Badge/Badge';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import type { TradeHistoryEntry, TradeEventType } from '@/features/trade/trade.types';
import styles from './PassbookEntry.module.scss';

const EVENT_LABELS: Record<TradeEventType, string> = {
  GOLD_PURCHASE: 'Gold Purchase',
  PHYSICAL_REDEMPTION: 'Physical Redemption',
  SYSTEM_REVERSAL: 'System Reversal',
  ADMIN_ADJUSTMENT: 'Admin Adjustment',
};

const EVENT_BADGE_VARIANTS: Record<TradeEventType, BadgeVariant> = {
  GOLD_PURCHASE: 'brand',
  PHYSICAL_REDEMPTION: 'success',
  SYSTEM_REVERSAL: 'danger',
  ADMIN_ADJUSTMENT: 'neutral',
};

const PAYMENT_MODE_LABELS: Record<string, string> = {
  ONLINE_PG: 'Online Payment',
  COUNTER_CASH: 'Store Cash',
  COUNTER_UPI: 'Store UPI',
  NONE: 'N/A',
};

function humanizePaymentMode(mode: string): string {
  return PAYMENT_MODE_LABELS[mode] ?? mode;
}

export function PassbookEntry({ entry }: { entry: TradeHistoryEntry }) {
  const signedWeight = entry.weight_grams >= 0 ? `+${entry.weight_grams.toFixed(4)}` : entry.weight_grams.toFixed(4);

  return (
    <div className={styles.entry}>
      <div className={styles.entryHeader}>
        <Badge variant={EVENT_BADGE_VARIANTS[entry.event_type]}>
          {EVENT_LABELS[entry.event_type] ?? entry.event_type}
        </Badge>
        <span className={styles.date}>{new Date(entry.created_at).toLocaleString('en-IN')}</span>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Weight</span>
          <span className={styles.detailValueBrand}>{signedWeight} g</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Amount</span>
          <span className={styles.detailValue}>{formatCurrency(entry.total_amount_inr, 'INR')}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Final Rate</span>
          <span className={styles.detailValue}>
            {formatCurrency(entry.final_rate_per_gram, 'INR')}/g
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Running Balance</span>
          <span className={styles.detailValue}>{entry.running_gold_balance_grams.toFixed(4)} g</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Payment Mode</span>
          <span className={styles.detailValue}>{humanizePaymentMode(entry.payment_mode)}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Reference</span>
          <span className={styles.detailValueMuted}>{entry.reference_id ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}
