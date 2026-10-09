'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import {
  ShieldIcon,
  ShieldCheckIcon,
  TruckIcon,
  HomeIcon,
  UserIcon,
  WalletIcon,
  CoinsIcon,
} from '@/components/common/icons/Icons';
import { AdminProfileMenu } from '@/components/admin/AdminProfileMenu/AdminProfileMenu';
import { isAdminDataSample } from '@/features/admin/admin.service';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './AdminShell.module.scss';

const NAV_ITEMS = [
  { href: ROUTES.adminDashboard, label: 'Overview', icon: HomeIcon },
  { href: ROUTES.adminCustomers, label: 'Customers', icon: UserIcon },
  { href: ROUTES.adminCounterSale, label: 'Counter sale', icon: CoinsIcon },
  { href: ROUTES.adminKycReview, label: 'KYC review', icon: ShieldCheckIcon },
  { href: ROUTES.adminPickups, label: 'Pickups', icon: TruckIcon },
  { href: ROUTES.adminLedger, label: 'Store ledger', icon: WalletIcon },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const tenantConfig = useTenantConfig();
  const tenantName = tenantConfig?.displayName ?? 'DigiGold';
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.titleGroup}>
            <span className={styles.iconBadge}>
              <ShieldIcon width={20} height={20} />
            </span>
            <div>
              <h1 className={styles.title}>Store dashboard</h1>
              <p className={styles.subtitle}>
                <span className={styles.tenantName}>{tenantName}</span>
                {' · '}Customer accounts &amp; gold transactions
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <AdminProfileMenu />
          </div>
        </div>
        <nav className={styles.navigation} aria-label="Store administration">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(styles.navLink, active && styles.navLinkActive)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon width={18} height={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {isAdminDataSample() && (
        <p className={styles.sampleNotice} role="note">
          <strong>Sample data.</strong> The figures and customers on these pages
          are examples, not {tenantName}&apos;s records. Demo mode is enabled.
        </p>
      )}

      <main className={styles.content}>{children}</main>
    </div>
  );
}
