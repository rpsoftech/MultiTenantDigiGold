'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/common/Card/Card';
import { useAppSelector } from '@/store/hooks';
import { selectCanViewStoreData } from '@/store/session/session.slice';
import styles from './StoreAccessGate.module.scss';

// Store pages call endpoints that only super admins and managers may use. Other roles
// would see every panel fail, so explain the restriction instead.
export function StoreAccessGate({ children }: { children: ReactNode }) {
  const canViewStoreData = useAppSelector(selectCanViewStoreData);
  if (canViewStoreData) return <>{children}</>;

  return (
    <Card className={styles.notice}>
      <h2 className={styles.title}>Store data isn’t available for your role</h2>
      <p className={styles.message}>
        Store analytics, customers and the ledger are limited to super admins and
        managers. Ask one of them if you need access.
      </p>
    </Card>
  );
}
