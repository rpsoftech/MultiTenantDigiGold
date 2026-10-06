'use client';

import { useState } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useAdminUsers } from '@/features/admin/hooks/useAdminUsers';
import { useUpdateKycStatus } from '@/features/admin/hooks/useUpdateKycStatus';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import {
  KYC_BADGE_VARIANT,
  KYC_LABEL,
} from '@/components/admin/adminStatusBadge';
import styles from './UserApprovalsTable.module.scss';

function joinedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

export function UserApprovalsTable() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { data, isLoading, isError, isFetching, refetch } = useAdminUsers(
    page,
    limit,
  );
  const updateKycStatus = useUpdateKycStatus();
  const users = data?.items ?? [];
  const firstCustomer = (page - 1) * limit + 1;

  return (
    <section aria-labelledby="customer-directory-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="customer-directory-title" className={styles.sectionTitle}>
            Customer directory
          </h2>
          <p className={styles.sectionDescription}>
            Customer vault balances, contact details, and KYC approvals.
          </p>
        </div>
        <label className={styles.pageSize}>
          Rows per page
          <select
            value={limit}
            disabled={isFetching}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {updateKycStatus.isError && (
        <p className={styles.actionError} role="alert">
          KYC status could not be updated. Please try again.
        </p>
      )}

      <Card className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.state}>
            <Loader label="Loading customers" />
            <p>Loading customer accounts…</p>
          </div>
        ) : isError ? (
          <div className={styles.state} role="alert">
            <strong>Customer directory is unavailable</strong>
            <p>We couldn’t load this page of customers. Please try again.</p>
            <Button
              variant="outlined"
              onClick={() => refetch()}
              isLoading={isFetching}
            >
              Try again
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div className={styles.state}>
            <strong>
              {page === 1 ? 'No customers yet' : 'No customers on this page'}
            </strong>
            <p>
              {page === 1
                ? 'Customer accounts and vault balances will appear here when customers join your store.'
                : 'Go to the previous page to see more customer accounts.'}
            </p>
          </div>
        ) : (
          <div className={styles.tableScroll} aria-busy={isFetching}>
            <table className={styles.table} aria-label="Customer directory">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Vault balance</th>
                  <th scope="col">KYC status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>KYC actions</span>
                  </th>
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
                    <td
                      className={styles.goldBalance}
                      data-label="Vault balance"
                    >
                      {user.goldBalanceGrams.toFixed(4)} g
                    </td>
                    <td data-label="KYC status">
                      <Badge variant={KYC_BADGE_VARIANT[user.kycStatus]}>
                        {KYC_LABEL[user.kycStatus]}
                      </Badge>
                    </td>
                    <td className={styles.joinedDate} data-label="Joined">
                      {joinedDate(user.joinedAt)}
                    </td>
                    <td className={styles.actionsCell}>
                      {user.kycStatus === 'pending' && (
                        <div className={styles.actions}>
                          <Button
                            className={styles.actionButton}
                            aria-label={`Approve KYC for ${user.name || user.userId}`}
                            disabled={updateKycStatus.isPending}
                            isLoading={
                              updateKycStatus.isPending &&
                              updateKycStatus.variables?.userId ===
                                user.userId &&
                              updateKycStatus.variables?.kycStatus ===
                                'verified'
                            }
                            onClick={() =>
                              updateKycStatus.mutate({
                                userId: user.userId,
                                kycStatus: 'verified',
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outlined"
                            className={styles.actionButton}
                            aria-label={`Reject KYC for ${user.name || user.userId}`}
                            disabled={updateKycStatus.isPending}
                            isLoading={
                              updateKycStatus.isPending &&
                              updateKycStatus.variables?.userId ===
                                user.userId &&
                              updateKycStatus.variables?.kycStatus ===
                                'rejected'
                            }
                            onClick={() =>
                              updateKycStatus.mutate({
                                userId: user.userId,
                                kycStatus: 'rejected',
                              })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav className={styles.pagination} aria-label="Customer pagination">
          <span className={styles.pageSummary} aria-live="polite">
            {isFetching
              ? 'Loading customers…'
              : isError
                ? `Page ${page}`
                : users.length
                  ? `Showing ${firstCustomer}–${firstCustomer + users.length - 1} customers`
                  : '0 customers on this page'}
          </span>
          <div className={styles.pageControls}>
            <Button
              variant="outlined"
              className={styles.pageButton}
              disabled={page === 1 || isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <span className={styles.pageNumber}>Page {page}</span>
            <Button
              variant="outlined"
              className={styles.pageButton}
              disabled={!data?.hasNextPage || isFetching || isError}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      </Card>
    </section>
  );
}
