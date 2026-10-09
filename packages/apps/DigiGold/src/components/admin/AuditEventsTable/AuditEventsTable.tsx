import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import {
  auditEventLabel,
  formatAuditTimestamp,
} from '@/features/admin/audit.constants';
import type { AuditEvent } from '@/features/admin/admin.types';
import styles from './AuditEventsTable.module.scss';

export function AuditEventsTable({
  events,
  tenantNames = {},
  onView,
  caption = 'Audit events',
}: {
  events: AuditEvent[];
  // Tenant UUID to display name, so rows read as names where the tenant is known.
  tenantNames?: Record<string, string>;
  onView: (event: AuditEvent) => void;
  caption?: string;
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Tenant</th>
            <th scope="col">Actor</th>
            <th scope="col">IP address</th>
            <th scope="col">Date &amp; time (IST)</th>
            <th scope="col">
              <span className={styles.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id || event.key}>
              <td data-label="Event">
                <div className={styles.event}>
                  <span className={styles.primary}>
                    {auditEventLabel(event.eventName)}
                  </span>
                  <span className={styles.reference}>{event.eventName}</span>
                  {!event.isProcessed && <Badge variant="neutral">Pending</Badge>}
                </div>
              </td>
              <td data-label="Tenant">
                <div className={styles.event}>
                  <span className={styles.primary}>
                    {tenantNames[event.tenantId] ?? '—'}
                  </span>
                  <span className={styles.reference}>{event.tenantId || '—'}</span>
                </div>
              </td>
              <td data-label="Actor">
                <span className={styles.reference}>{event.adminId ?? '—'}</span>
              </td>
              <td data-label="IP address">
                <span>{event.ipAddress ?? '—'}</span>
              </td>
              <td data-label="Date & time (IST)">
                <time className={styles.date} dateTime={event.occurredAt}>
                  {formatAuditTimestamp(event.occurredAt)}
                </time>
              </td>
              <td className={styles.actionsCell} data-label="Details">
                <Button
                  variant="outlined"
                  className={styles.actionButton}
                  aria-label={`View details for ${event.eventName} event ${event.id}`}
                  onClick={() => onView(event)}
                >
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
