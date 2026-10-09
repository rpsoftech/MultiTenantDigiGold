'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/common/Card/Card';
import { useAppSelector } from '@/store/hooks';
import { selectIsSuperAdmin } from '@/store/session/session.slice';
import styles from '../StoreAccessGate/StoreAccessGate.module.scss';

// The audit log spans every tenant and only super admins may read it, so other roles
// would see the request fail. Explain the restriction instead.
export function AuditAccessGate({ children }: { children: ReactNode }) {
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);
  if (isSuperAdmin) return <>{children}</>;

  return (
    <Card className={styles.notice}>
      <h2 className={styles.title}>The audit log isn’t available for your role</h2>
      <p className={styles.message}>
        The audit log is limited to super admins. Ask one of them if you need
        access.
      </p>
    </Card>
  );
}
