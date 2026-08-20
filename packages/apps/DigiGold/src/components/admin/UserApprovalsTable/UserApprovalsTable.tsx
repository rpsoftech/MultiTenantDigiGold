'use client';

import { Card } from '@/components/common/Card/Card';
import { Badge, type BadgeVariant } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useAdminUsers } from '@/features/admin/hooks/useAdminUsers';
import { useUpdateKycStatus } from '@/features/admin/hooks/useUpdateKycStatus';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import type { KycStatus } from '@/features/admin/admin.types';
import styles from './UserApprovalsTable.module.scss';

const KYC_BADGE_VARIANT: Record<KycStatus, BadgeVariant> = {
  verified: 'success',
  pending: 'neutral',
  rejected: 'danger',
  not_started: 'neutral',
};

const KYC_LABEL: Record<KycStatus, string> = {
  verified: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  not_started: 'Not Started',
};

export type UserApprovalsTableProps = {
  selectedUserId: string | null;
  onViewLogs: (userId: string) => void;
};

export function UserApprovalsTable({ selectedUserId, onViewLogs }: UserApprovalsTableProps) {
  const { data: users, isLoading } = useAdminUsers();
  const updateKycStatus = useUpdateKycStatus();

  return (
    <section>
      <h2 className={styles.sectionTitle}>User Approvals &amp; Account Directory</h2>

      <Card className={styles.tableCard}>
        {isLoading || !users ? (
          <Loader />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User ID &amp; Name</th>
                <th>Mobile</th>
                <th>City</th>
                <th>Gold Balance</th>
                <th>KYC Status</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId}>
                  <td>
                    <span className={styles.userName}>{user.name}</span>
                    <span className={styles.userId}>{user.userId}</span>
                  </td>
                  <td>+91 {formatMobileNumber(user.mobileNumber)}</td>
                  <td>{user.city}</td>
                  <td className={styles.goldBalance}>{user.goldBalanceGrams.toFixed(4)} g</td>
                  <td>
                    <Badge variant={KYC_BADGE_VARIANT[user.kycStatus]}>
                      {KYC_LABEL[user.kycStatus]}
                    </Badge>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {user.kycStatus === 'pending' && (
                        <>
                          <Button
                            className={styles.actionButton}
                            isLoading={
                              updateKycStatus.isPending &&
                              updateKycStatus.variables?.userId === user.userId &&
                              updateKycStatus.variables?.kycStatus === 'verified'
                            }
                            onClick={() =>
                              updateKycStatus.mutate({ userId: user.userId, kycStatus: 'verified' })
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outlined"
                            className={styles.actionButton}
                            isLoading={
                              updateKycStatus.isPending &&
                              updateKycStatus.variables?.userId === user.userId &&
                              updateKycStatus.variables?.kycStatus === 'rejected'
                            }
                            onClick={() =>
                              updateKycStatus.mutate({ userId: user.userId, kycStatus: 'rejected' })
                            }
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        variant="secondary"
                        className={styles.actionButton}
                        onClick={() => onViewLogs(user.userId)}
                      >
                        {selectedUserId === user.userId ? 'Viewing Logs' : 'View Logs'}
                      </Button>
                    </div>
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
