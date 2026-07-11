'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { Button } from '@/components/common/Button/Button';
import { Logo } from '@/components/common/Logo/Logo';
import { ArrowLeftIcon, LockIcon } from '@/components/common/icons/Icons';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './Header.module.scss';

// Nav labels are static app navigation, not tenant branding — only the logo text/image
// and which module-gated links appear come from tenantConfig, per the "never branch on
// tenantId" rule (this branches on activeModules, not tenantId).
export function Header() {
  const tenantConfig = useTenantConfig();
  const pathname = usePathname();
  const router = useRouter();
  const brandName = tenantConfig?.displayName ?? 'DigiGold';
  const isLoginPage = pathname === ROUTES.login;

  return (
    <header className={styles.header}>
      {/* Compact bar — mobile only. The login screen shows its own in-card brand mark
          instead (per the mobile reference), so this renders nothing there. */}
      <div className={cn(styles.mobileBar, isLoginPage && styles.mobileBarHidden)}>
        {!isLoginPage && (
          <button
            type="button"
            className={styles.backButton}
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeftIcon width={18} height={18} />
          </button>
        )}
        <span className={styles.mobileBrand}>
          <LockIcon width={16} height={16} />
          {brandName.toUpperCase()}
        </span>
      </div>

      {/* Full marketing header — desktop (md+) only. */}
      <div className={styles.inner}>
        <Link href="/" className={styles.logoLink}>
          <Logo height={28} />
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {tenantConfig?.activeModules.ecommerce && (
            <Link href="#" className={styles.navLink}>
              Marketplace
            </Link>
          )}
          {tenantConfig?.activeModules.vault && (
            <Link href="#" className={styles.navLink}>
              Vault
            </Link>
          )}
          {tenantConfig?.activeModules.trading && (
            <Link href="#" className={styles.navLink}>
              Invest
            </Link>
          )}
          <Link href="#" className={styles.navLink}>
            About
          </Link>
        </nav>

        <div className={styles.actions}>
          <Link href={ROUTES.login} className={styles.signIn}>
            Sign In
          </Link>
          <Button variant="outlined" className={styles.openAccount}>
            Open Account
          </Button>
        </div>
      </div>
    </header>
  );
}
