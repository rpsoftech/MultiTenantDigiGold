'use client';

import { useState } from 'react';
import {
  PagedTable,
  pagedTableStyles as styles,
  type PagedTableText,
} from '@/components/admin/PagedTable/PagedTable';
import { useCollectedRedemptions } from '@/features/admin/hooks/useCollectedRedemptions';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';

const PAGE_SIZE = 20;

const TEXT: PagedTableText = {
  loadingLabel: 'Loading today’s handovers',
  loadingDetail: 'Loading today’s handovers…',
  errorTitle: 'Today’s handovers are unavailable',
  errorDetail: 'We couldn’t load the collected pickups. Please try again.',
  emptyTitle: 'Nothing handed over yet today',
  emptyDetail: 'Pickups collected at the counter today will appear here.',
  emptyPageTitle: 'No handovers on this page',
  emptyPageDetail: 'Go to the previous page to see more handovers.',
  noun: 'handovers',
  paginationLabel: 'Collected pickups pagination',
};

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      });
}

// Today's handovers at the counter, with who handed each one over, for the end-of-day count.
export function CollectedTodayTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } =
    useCollectedRedemptions(page, PAGE_SIZE);
  const handovers = data?.items ?? [];

  return (
    <PagedTable
      titleId="collected-today-title"
      title="Collected today"
      description="Gold handed over at the counter today (IST), newest first, and who handed it over."
      text={TEXT}
      page={page}
      limit={PAGE_SIZE}
      onPageChange={setPage}
      itemCount={handovers.length}
      hasNextPage={data?.hasNextPage ?? false}
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      onRetry={() => void refetch()}
      tableLabel="Pickups collected today"
      minWidth={720}
    >
      <thead>
        <tr>
          <th scope="col">Customer</th>
          <th scope="col">Mobile</th>
          <th scope="col">Gold</th>
          <th scope="col">Handed over (IST)</th>
          <th scope="col">By</th>
        </tr>
      </thead>
      <tbody>
        {handovers.map((handover) => (
          <tr key={handover.id}>
            <td data-label="Customer">
              <div>
                <span className={styles.userName}>{handover.customerName}</span>
                <span className={styles.userId}>{handover.id}</span>
              </div>
            </td>
            <td data-label="Mobile">
              +91 {formatMobileNumber(handover.customerPhone)}
            </td>
            <td className={styles.goldBalance} data-label="Gold">
              {handover.weightGrams.toFixed(4)} g
            </td>
            <td className={styles.dateCell} data-label="Handed over (IST)">
              <time dateTime={handover.collectedAt}>
                {formatTime(handover.collectedAt)}
              </time>
            </td>
            <td data-label="By">{handover.collectedBy}</td>
          </tr>
        ))}
      </tbody>
    </PagedTable>
  );
}
