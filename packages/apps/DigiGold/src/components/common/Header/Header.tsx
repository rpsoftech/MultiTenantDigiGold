'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { Logo } from '@/components/common/Logo/Logo';
import { ArrowLeftIcon, MenuIcon } from '@/components/common/icons/Icons';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';
import { useHeaderConfig } from './useHeaderConfig';
import { NavMenu } from './NavMenu';
import { MobileNav } from './MobileNav';
import { HeaderActionLink } from './HeaderActionLink';
import styles from './Header.module.scss';

// Routes reached mid-flow (not the flow's entry point) get a back button — the login
// screen shows its own in-card brand mark instead, per the mobile reference.
const BACK_NAVIGABLE_ROUTES: string[] = [ROUTES.otp, ROUTES.profileSetup];

export function Header() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const tenantConfig = useTenantConfig();
  const headerConfig = useHeaderConfig();
  const pathname = usePathname();
  const router = useRouter();

  const showBackButton = BACK_NAVIGABLE_ROUTES.includes(pathname);
  const brandName = tenantConfig?.displayName ?? 'DigiGold';
  const { logo } = headerConfig;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.leading}>
          {showBackButton && (
            <button
              type="button"
              className={styles.backButton}
              onClick={() => router.back()}
              aria-label="Go back"
            >
              <ArrowLeftIcon width={18} height={18} />
            </button>
          )}

          <Link href={logo.url} className={styles.logoLink}>
            {logo.image ? (
              <Image
                src={logo.image}
                alt={logo.text || brandName}
                width={196}
                height={38}
                className={styles.logoImage}
              />
            ) : logo.text ? (
              <span className={styles.logoText}>{logo.text}</span>
            ) : (
              <Logo height={34} />
            )}
          </Link>
        </div>

        <NavMenu items={headerConfig.menus} />

        <div className={styles.actions}>
          {headerConfig.actions.map((action) => (
            <HeaderActionLink key={action.id} action={action} />
          ))}
        </div>

        <button
          type="button"
          className={cn(styles.hamburger, mobileNavOpen && styles.hamburgerHidden)}
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon width={22} height={22} />
        </button>
      </div>

      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        menus={headerConfig.menus}
        actions={headerConfig.actions}
      />
    </header>
  );
}
