'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { DatePickerField } from '@/components/common/DatePickerField/DatePickerField';
import { AuditEventsTable } from '@/components/admin/AuditEventsTable/AuditEventsTable';
import { AuditEventPayloadDrawer } from '@/components/admin/AuditEventPayloadDrawer/AuditEventPayloadDrawer';
import { useAuditEvents } from '@/features/admin/hooks/useAuditEvents';
import { useAdminTenants } from '@/features/admin/hooks/useAdminTenants';
import {
  AUDIT_EVENT_TYPES,
  auditEventLabel,
} from '@/features/admin/audit.constants';
import type { AuditEvent } from '@/features/admin/admin.types';
import styles from './AuditEventsPanel.module.scss';

const PAGE_SIZES = [10, 20, 50, 100];

function toIsoDate(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function AuditEventsPanel() {
  const [tenantUuid, setTenantUuid] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const filters = useMemo(
    () => ({
      tenantUuid: tenantUuid || undefined,
      type: type || undefined,
      from: toIsoDate(from),
      to: toIsoDate(to),
    }),
    [tenantUuid, type, from, to],
  );
  const hasFilters = Boolean(tenantUuid || type || from || to);

  const { data, isLoading, isError, isFetching, refetch } = useAuditEvents(
    filters,
    page,
    limit,
  );
  const tenants = useAdminTenants();
  const tenantOptions = tenants.data ?? [];
  const tenantNames = useMemo(
    () =>
      Object.fromEntries(
        tenantOptions.map((tenant) => [tenant.tenantUuid, tenant.name]),
      ),
    [tenantOptions],
  );

  const events = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Any filter change starts again from the first page.
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function clearFilters() {
    setTenantUuid('');
    setType('');
    setFrom(undefined);
    setTo(undefined);
    setPage(1);
  }

  return (
    <section className={styles.section} aria-labelledby="audit-events-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Platform activity</p>
          <h2 className={styles.title} id="audit-events-title">
            Audit log
          </h2>
          <p className={styles.description}>
            Logins, configuration changes, KYC and trade events, with the latest
            first.
          </p>
        </div>
        <Button
          variant="secondary"
          className={styles.action}
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching && !isLoading ? 'Refreshing…' : 'Refresh log'}
        </Button>
      </div>

      <Card className={styles.card}>
        <form
          className={styles.filters}
          aria-label="Audit log filters"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className={styles.field}>
            <label htmlFor="audit-tenant">Tenant</label>
            <select
              id="audit-tenant"
              className={styles.select}
              value={tenantUuid}
              onChange={(event) =>
                changeFilter(() => setTenantUuid(event.target.value))
              }
            >
              <option value="">All tenants</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.tenantUuid} value={tenant.tenantUuid}>
                  {tenant.name}
                </option>
              ))}
            </select>
            {tenants.isError && (
              <p className={styles.hint} role="alert">
                Couldn’t load tenants.{' '}
                <button type="button" onClick={() => void tenants.refetch()}>
                  Retry
                </button>
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="audit-type">Event type</label>
            <select
              id="audit-type"
              className={styles.select}
              value={type}
              onChange={(event) => changeFilter(() => setType(event.target.value))}
            >
              <option value="">All types</option>
              {AUDIT_EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {auditEventLabel(eventType)}
                </option>
              ))}
            </select>
          </div>

          <DatePickerField
            label="From"
            name="audit-from"
            value={from}
            maxDate={to}
            onChange={(date) => changeFilter(() => setFrom(date))}
          />
          <DatePickerField
            label="To"
            name="audit-to"
            value={to}
            minDate={from}
            onChange={(date) => changeFilter(() => setTo(date))}
          />

          <div className={styles.filterActions}>
            <Button
              type="button"
              variant="outlined"
              className={styles.action}
              disabled={!hasFilters}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          </div>
        </form>
        <p className={styles.note}>
          Some events (admin logins, trades, refunds and redemptions) are recorded
          against a numeric tenant ID, so they may not appear when a single tenant
          is selected.
        </p>

        {isLoading ? (
          <div className={styles.state}>
            <Loader label="Loading audit log" />
          </div>
        ) : isError ? (
          <div className={styles.state} role="alert">
            <h3>Couldn’t load the audit log</h3>
            <p>Please try again to see recorded events.</p>
            <Button
              variant="secondary"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              Try again
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className={styles.state}>
            <h3>
              {page > 1
                ? 'You’ve reached the end of the log'
                : hasFilters
                  ? 'No events match these filters'
                  : 'No events recorded yet'}
            </h3>
            <p>
              {page > 1
                ? 'Return to the previous page to view recorded events.'
                : hasFilters
                  ? 'Try widening the date range or clearing a filter.'
                  : 'Events will appear here as they are recorded.'}
            </p>
            {page === 1 && hasFilters && (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <AuditEventsTable
            events={events}
            tenantNames={tenantNames}
            onView={setSelected}
          />
        )}

        <nav className={styles.pagination} aria-label="Audit log pagination">
          <p aria-live="polite">
            Page {page} of {totalPages}
            {!isLoading && !isError && (
              <span>
                {' '}
                · {total} {total === 1 ? 'event' : 'events'}
              </span>
            )}
          </p>
          <div className={styles.pageActions}>
            <label className={styles.pageSize}>
              Rows per page
              <select
                className={styles.select}
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              className={styles.action}
              disabled={page === 1 || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className={styles.action}
              disabled={page >= totalPages || isFetching || isError}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      </Card>

      <AuditEventPayloadDrawer
        event={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
