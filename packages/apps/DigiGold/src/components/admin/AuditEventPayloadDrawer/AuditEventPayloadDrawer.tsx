'use client';

import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Drawer } from '@/components/common/Drawer/Drawer';
import { useToast } from '@/components/common/Toast/Toast';
import {
  auditEventLabel,
  formatAuditTimestamp,
} from '@/features/admin/audit.constants';
import type { AuditEvent } from '@/features/admin/admin.types';
import styles from './AuditEventPayloadDrawer.module.scss';

export function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return 'No payload';
  try {
    return JSON.stringify(payload, null, 2) ?? 'No payload';
  } catch {
    return String(payload);
  }
}

export function AuditEventPayloadDrawer({
  event,
  onClose,
}: {
  event: AuditEvent | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const payloadText = event ? formatPayload(event.payload) : '';
  const hasPayload = event?.payload !== null && event?.payload !== undefined;

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(payloadText);
      showToast({ title: 'Payload copied', variant: 'success' });
    } catch {
      showToast({
        title: 'Couldn’t copy the payload',
        description: 'Select the text and copy it manually.',
        variant: 'danger',
      });
    }
  }

  return (
    <Drawer
      open={event !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={event ? auditEventLabel(event.eventName) : 'Event details'}
      description={event?.eventName}
    >
      {event && (
        <>
          <dl className={styles.meta}>
            <div>
              <dt>Event ID</dt>
              <dd>{event.id || '—'}</dd>
            </div>
            <div>
              <dt>Occurred at (IST)</dt>
              <dd>{formatAuditTimestamp(event.occurredAt)}</dd>
            </div>
            <div>
              <dt>Tenant</dt>
              <dd>{event.tenantId || '—'}</dd>
            </div>
            <div>
              <dt>Admin</dt>
              <dd>{event.adminId ?? '—'}</dd>
            </div>
            <div>
              <dt>IP address</dt>
              <dd>{event.ipAddress ?? '—'}</dd>
            </div>
            <div>
              <dt>Key</dt>
              <dd>{event.key || '—'}</dd>
            </div>
            <div>
              <dt>Processing</dt>
              <dd>
                <Badge variant={event.isProcessed ? 'success' : 'neutral'}>
                  {event.isProcessed ? 'Processed' : 'Pending'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>Parent events</dt>
              <dd>
                {event.parentNames.length > 0
                  ? event.parentNames.join(', ')
                  : '—'}
              </dd>
            </div>
          </dl>

          <div className={styles.payloadHeader}>
            <h3>Payload</h3>
            {hasPayload && (
              <Button
                variant="outlined"
                className={styles.copy}
                onClick={() => void copyPayload()}
              >
                Copy
              </Button>
            )}
          </div>
          <pre className={styles.payload} tabIndex={0} aria-label="Event payload">
            {payloadText}
          </pre>
        </>
      )}
    </Drawer>
  );
}
