'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { DatePickerField } from '@/components/common/DatePickerField/DatePickerField';
import { AuditEventsTable } from '@/components/admin/AuditEventsTable/AuditEventsTable';
import { AuditEventPayloadDrawer } from '@/components/admin/AuditEventPayloadDrawer/AuditEventPayloadDrawer';
import {
  PagedTable,
  pagedTableStyles,
  type PagedTableText,
} from '@/components/admin/PagedTable/PagedTable';
import { useAuditEvents } from '@/features/admin/hooks/useAuditEvents';
import { useAdminTenants } from '@/features/admin/hooks/useAdminTenants';
import {
  AUDIT_EVENT_TYPES,
  auditEventTypeLabel,
} from '@/features/admin/audit.constants';
import type { AuditEvent } from '@/features/admin/admin.types';
import styles from './AuditEventsPanel.module.scss';

const PAGE_SIZES = [10, 20, 50, 100];

const TEXT: PagedTableText = {
  loadingLabel: 'Loading audit log',
  loadingDetail: 'Loading audit log…',
  errorTitle: 'Couldn’t load the audit log',
  errorDetail: 'Please try again to see recorded events.',
  emptyTitle: 'No events recorded yet',
  emptyDetail: 'Events will appear here as they are recorded.',
  emptyPageTitle: 'You’ve reached the end of the log',
  emptyPageDetail: 'Return to the previous page to view recorded events.',
  noun: 'events',
  nounOne: 'event',
  paginationLabel: 'Audit log pagination',
};

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
    <>
      <PagedTable
        titleId="audit-events-title"
        title="Audit log"
        description="Logins, configuration changes, KYC decisions and ledger movements, with the latest first."
        text={TEXT}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        pageSizes={PAGE_SIZES}
        total={data?.total ?? 0}
        itemCount={events.length}
        hasNextPage={page < totalPages}
        isLoading={isLoading}
        isError={isError}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        tableLabel="Audit events"
        minWidth={900}
        actions={
          <Button
            variant="secondary"
            className={styles.action}
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching && !isLoading ? 'Refreshing…' : 'Refresh log'}
          </Button>
        }
        toolbar={
          <Card className={styles.filtersCard}>
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
                    <button
                      type="button"
                      onClick={() => void tenants.refetch()}
                    >
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
                  onChange={(event) =>
                    changeFilter(() => setType(event.target.value))
                  }
                >
                  <option value="">All types</option>
                  {AUDIT_EVENT_TYPES.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {auditEventTypeLabel(eventType)}
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
          </Card>
        }
        emptyState={
          page === 1 && hasFilters ? (
            <div className={pagedTableStyles.state}>
              <strong>No events match these filters</strong>
              <p>Try widening the date range or clearing a filter.</p>
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : undefined
        }
      >
        <AuditEventsTable
          events={events}
          tenantNames={tenantNames}
          onView={setSelected}
        />
      </PagedTable>

      <AuditEventPayloadDrawer
        event={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
