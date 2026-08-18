'use client';

import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { Loader } from '@/components/common/Loader/Loader';
import { useRecentUsers } from '@/features/admin/hooks/useRecentUsers';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import { KYC_BADGE_VARIANT, KYC_LABEL } from '@/components/admin/adminStatusBadge';
import styles from './RecentUsersTable.module.scss';

export function RecentUsersTable() {
  const { data: users, isLoading } = useRecentUsers();

  return (
    <section>
      <h2 className={styles.sectionTitle}>Recent Users</h2>

      <Card className={styles.tableCard}>
        {isLoading || !users ? (
          <Loader />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / Phone</th>
                <th>Joined Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId}>
                  <td className={styles.userName}>{user.name}</td>
                  <td>
                    {user.email && <span className={styles.contactLine}>{user.email}</span>}
                    <span className={styles.contactLine}>
                      +91 {formatMobileNumber(user.mobileNumber)}
                    </span>
                  </td>
                  <td>{new Date(user.joinedAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <Badge variant={KYC_BADGE_VARIANT[user.kycStatus]}>
                      {KYC_LABEL[user.kycStatus]}
                    </Badge>
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
