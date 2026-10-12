'use client';

import { useState } from 'react';
import { Badge } from '@/components/common/Badge/Badge';
import {
  PagedTable,
  pagedTableStyles as styles,
  type PagedTableText,
} from '@/components/admin/PagedTable/PagedTable';
import { useAdminUsers } from '@/features/admin/hooks/useAdminUsers';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import {
  KYC_BADGE_VARIANT,
  KYC_LABEL,
} from '@/components/admin/adminStatusBadge';

const TEXT: PagedTableText = {
  loadingLabel: 'Loading customers',
  loadingDetail: 'Loading customer accounts…',
  errorTitle: 'Customer directory is unavailable',
  errorDetail: 'We couldn’t load this page of customers. Please try again.',
  emptyTitle: 'No customers yet',
  emptyDetail:
    'Customer accounts and vault balances will appear here when customers join your store.',
  emptyPageTitle: 'No customers on this page',
  emptyPageDetail: 'Go to the previous page to see more customer accounts.',
  noun: 'customers',
  paginationLabel: 'Customer pagination',
};

function joinedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
}

export function CustomerDirectoryTable() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { data, isLoading, isError, isFetching, refetch } = useAdminUsers(
    page,
    limit,
  );
  const users = data?.items ?? [];

  return (
    <PagedTable
      titleId="customer-directory-title"
      title="Customer directory"
      description="Customer vault balances, contact details, and KYC status."
      text={TEXT}
      page={page}
      limit={limit}
      onPageChange={setPage}
      onLimitChange={setLimit}
      itemCount={users.length}
      hasNextPage={data?.hasNextPage ?? false}
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      onRetry={() => void refetch()}
      tableLabel="Customer directory"
      minWidth={760}
    >
      <thead>
        <tr>
          <th scope="col">Customer</th>
          <th scope="col">Contact</th>
          <th scope="col">Vault balance</th>
          <th scope="col">KYC status</th>
          <th scope="col">Joined</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.userId}>
            <td data-label="Customer">
              <div>
                <span className={styles.userName}>
                  {user.name || 'Unnamed customer'}
                </span>
                <span className={styles.userId}>{user.userId}</span>
              </div>
            </td>
            <td data-label="Contact">
              <div className={styles.contact}>
                <span>
                  {user.mobileNumber
                    ? `+91 ${formatMobileNumber(user.mobileNumber)}`
                    : '—'}
                </span>
                {user.email && (
                  <span className={styles.email}>{user.email}</span>
                )}
              </div>
            </td>
            <td className={styles.goldBalance} data-label="Vault balance">
              {user.goldBalanceGrams.toFixed(4)} g
            </td>
            <td data-label="KYC status">
              <Badge variant={KYC_BADGE_VARIANT[user.kycStatus]}>
                {KYC_LABEL[user.kycStatus]}
              </Badge>
            </td>
            <td className={styles.dateCell} data-label="Joined">
              {joinedDate(user.joinedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </PagedTable>
  );
}
