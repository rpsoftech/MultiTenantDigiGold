import { Badge } from '@/components/common/Badge/Badge';
import type { AdminLedgerEntry } from '@/features/admin/admin.types';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import styles from './StoreLedgerTable.module.scss';

const EVENT_LABELS: Record<string, string> = {
  GOLD_PURCHASE: 'Gold purchase',
  PHYSICAL_REDEMPTION: 'Physical redemption',
  SYSTEM_REVERSAL: 'System reversal',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

const PAYMENT_LABELS: Record<string, string> = {
  ONLINE_PG: 'Online payment',
  COUNTER_CASH: 'Counter · Cash',
  COUNTER_UPI: 'Counter · UPI',
  NONE: 'No payment',
};

function readableLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

export function StoreLedgerTable({
  entries,
  caption = 'Store ledger entries',
}: {
  entries: AdminLedgerEntry[];
  caption?: string;
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Transaction</th>
            <th scope="col">Amount / Weight</th>
            <th scope="col">Payment mode</th>
            <th scope="col">Vault after entry</th>
            <th scope="col">Status</th>
            <th scope="col">Date &amp; time (IST)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isReversal = entry.eventType === 'SYSTEM_REVERSAL';
            return (
              <tr key={entry.id}>
                <td data-label="Transaction">
                  <div className={styles.transaction}>
                    <span className={styles.primary}>
                      {EVENT_LABELS[entry.eventType] ??
                        readableLabel(entry.eventType)}
                    </span>
                    <span className={styles.reference}>{entry.id}</span>
                    {entry.referenceId && !entry.reversesLedgerId && (
                      <span className={styles.reference}>
                        Ref: {entry.referenceId}
                      </span>
                    )}
                  </div>
                </td>
                <td data-label="Amount / Weight">
                  <div className={styles.numeric}>
                    <span className={styles.primary}>
                      {formatCurrency(entry.amountInr, 'INR', 2)}
                    </span>
                    <span
                      className={
                        entry.weightGrams < 0 ? styles.debit : styles.credit
                      }
                    >
                      {entry.weightGrams > 0 ? '+' : ''}
                      {entry.weightGrams.toFixed(4)} g
                    </span>
                  </div>
                </td>
                <td data-label="Payment mode">
                  <span>
                    {PAYMENT_LABELS[entry.paymentMode] ??
                      readableLabel(entry.paymentMode)}
                  </span>
                </td>
                <td data-label="Vault after entry">
                  <span className={styles.balance}>
                    {entry.runningGoldBalanceGrams.toFixed(4)} g
                  </span>
                </td>
                <td data-label="Status">
                  <div className={styles.status}>
                    <Badge
                      variant={
                        entry.isReversed
                          ? 'danger'
                          : isReversal
                            ? 'brand'
                            : 'neutral'
                      }
                    >
                      {entry.isReversed
                        ? 'Reversed'
                        : isReversal
                          ? 'Reversal'
                          : 'Recorded'}
                    </Badge>
                    {entry.reversesLedgerId && (
                      <span className={styles.reference}>
                        Reverses: {entry.reversesLedgerId}
                      </span>
                    )}
                  </div>
                </td>
                <td data-label="Date & time (IST)">
                  <time className={styles.date} dateTime={entry.timestamp}>
                    {formatDate(entry.timestamp)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
