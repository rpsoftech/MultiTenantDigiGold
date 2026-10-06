'use client';

import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useRecentUsers } from '@/features/admin/hooks/useRecentUsers';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import {
  KYC_BADGE_VARIANT,
  KYC_LABEL,
} from '@/components/admin/adminStatusBadge';
import styles from './RecentUsersTable.module.scss';

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

export function RecentUsersTable() {
  const {
    data: users,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useRecentUsers();

  return (
    <section aria-labelledby="recent-customers-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="recent-customers-title" className={styles.sectionTitle}>
            Recent customers
          </h2>
          <p className={styles.sectionDescription}>
            New accounts and their current vault balances.
          </p>
        </div>
        <Link className={styles.viewAll} href="/admin/customers">
          View all customers <span aria-hidden>→</span>
        </Link>
      </div>

      <Card className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.state}>
            <Loader label="Loading recent customers" />
            <p>Loading recent customers…</p>
          </div>
        ) : isError ? (
          <div className={styles.state} role="alert">
            <strong>Customers are unavailable</strong>
            <p>We couldn’t load recent customers. Please try again.</p>
            <Button
              variant="outlined"
              onClick={() => refetch()}
              isLoading={isFetching}
            >
              Try again
            </Button>
          </div>
        ) : !users?.length ? (
          <div className={styles.state}>
            <strong>No customers yet</strong>
            <p>
              New customer accounts will appear here when customers join your
              store.
            </p>
          </div>
        ) : (
          <table
            className={styles.table}
            aria-label="Recent customers"
            aria-busy={isFetching}
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
                  <td className={styles.userName} data-label="Customer">
                    {user.name || 'Unnamed customer'}
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
                  <td className={styles.joinedDate} data-label="Joined">
                    {joinedDate(user.joinedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}
