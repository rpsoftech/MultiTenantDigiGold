'use client';

import * as Popover from '@radix-ui/react-popover';
import { useSession } from '@/features/auth/hooks/useSession';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import Link from 'next/link';
import { ChevronDownIcon, LogOutIcon, ShieldCheckIcon, UserIcon } from '@/components/common/icons/Icons';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './ProfileMenu.module.scss';

// Customer-facing counterpart to AdminProfileMenu. No account/profile screen exists yet
// in phase 1 (see CLAUDE.md build order), so the dropdown offers KYC and Logout for now.
// `onNavigate` lets a container close itself too — the mobile nav dialog stays open after
// a client-side route change otherwise.
//
// `inline` renders the same entries as a flat list instead of a popover. The mobile nav is a
// modal dialog: a portalled popover would sit behind it and be non-interactive, so inside the
// drawer the entries are shown directly.
export function ProfileMenu({ onNavigate, inline = false }: { onNavigate?: () => void; inline?: boolean }) {
  const { user } = useSession();
  const logout = useLogout();
  const label = user?.name ?? (user?.mobileNumber ? formatMobileNumber(user.mobileNumber) : 'Account');

  if (inline) {
    return (
      <div className={styles.inline}>
        <div className={styles.inlineUser}>
          <span className={styles.avatar}>
            <UserIcon width={16} height={16} />
          </span>
          <span className={styles.inlineName}>{label}</span>
        </div>
        <Link href={ROUTES.kyc} className={styles.item} onClick={onNavigate}>
          <ShieldCheckIcon width={16} height={16} />
          KYC Verification
        </Link>
        <button
          type="button"
          className={cn(styles.item, styles.logoutItem)}
          onClick={() => {
            onNavigate?.();
            logout();
          }}
        >
          <LogOutIcon width={16} height={16} />
          Logout
        </button>
      </div>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={styles.trigger} aria-label="Account menu">
          <span className={styles.avatar}>
            <UserIcon width={16} height={16} />
          </span>
          <span className={styles.name}>{label}</span>
          <ChevronDownIcon width={14} height={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} align="end" sideOffset={8}>
          {/* A Popover (unlike a DropdownMenu) doesn't close when an item inside it is
              activated, and the header survives the route change — close it explicitly. */}
          <Popover.Close asChild>
            <Link href={ROUTES.kyc} className={styles.item} onClick={onNavigate}>
              <ShieldCheckIcon width={16} height={16} />
              KYC Verification
            </Link>
          </Popover.Close>
          <button type="button" className={cn(styles.item, styles.logoutItem)} onClick={logout}>
            <LogOutIcon width={16} height={16} />
            Logout
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
