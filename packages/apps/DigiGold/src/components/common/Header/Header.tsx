'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useSession } from '@/features/auth/hooks/useSession';
import { Logo } from '@/components/common/Logo/Logo';
import { ProfileMenu } from '@/components/common/ProfileMenu/ProfileMenu';
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
  const { isAuthenticated } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const showBackButton = BACK_NAVIGABLE_ROUTES.includes(pathname);
  const brandName = tenantConfig?.displayName ?? 'DigiGold';
  const { logo } = headerConfig;
  // "Sign In" only makes sense to a logged-out visitor — header.config.json is static
  // site config with no session awareness, so filter it here instead of in the config.
  const actions = headerConfig.actions.filter(
    (action) => !isAuthenticated || action.url !== ROUTES.login
  );
  // Same idea for tenant modules: the static config tags items with a module, and a tenant
  // that has it switched off shouldn't be offered a link to an unavailable page.
  const menus = headerConfig.menus.filter(
    (item) => !item.module || (tenantConfig?.activeModules[item.module] ?? true)
  );

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

        <NavMenu items={menus} />

        <div className={styles.actions}>
          {actions.map((action) => (
            <HeaderActionLink key={action.id} action={action} />
          ))}
          {isAuthenticated && <ProfileMenu />}
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
        menus={menus}
        actions={actions}
        profileMenu={isAuthenticated ? <ProfileMenu /> : undefined}
      />
    </header>
  );
}
