'use client';

import type { ReactNode } from 'react';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { Badge } from '@/components/common/Badge/Badge';
import { ShieldIcon } from '@/components/common/icons/Icons';
import { AdminProfileMenu } from '@/components/admin/AdminProfileMenu/AdminProfileMenu';
import { isAdminDataSample } from '@/features/admin/admin.service';
import styles from './AdminShell.module.scss';

export function AdminShell({ children }: { children: ReactNode }) {
  const tenantConfig = useTenantConfig();
  const tenantName = tenantConfig?.displayName ?? 'DigiGold';

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.titleGroup}>
            <span className={styles.iconBadge}>
              <ShieldIcon width={20} height={20} />
            </span>
            <div>
              <h1 className={styles.title}>Multi-Tenant Admin Control Panel</h1>
              <p className={styles.subtitle}>
                Managing end-users, KYC verifications, and trade logs for{' '}
                <span className={styles.tenantName}>{tenantName}</span>
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <Badge variant="success">Market Trading Gate: Open</Badge>
            <AdminProfileMenu />
          </div>
        </div>
      </header>

      {isAdminDataSample() && (
        <p className={styles.sampleNotice} role="note">
          <strong>Sample data.</strong> The figures and customers on these pages
          are examples, not {tenantName}&apos;s records: the store data
          isn&apos;t connected yet.
        </p>
      )}

      <main className={styles.content}>{children}</main>
    </div>
  );
}
