'use client';

import * as Popover from '@radix-ui/react-popover';
import Link from 'next/link';
import { useAppSelector } from '@/store/hooks';
import { selectSessionUser } from '@/store/session/session.slice';
import { useAdminLogout } from '@/features/admin-auth/hooks/useAdminLogout';
import { ROUTES } from '@/lib/constants/routes';
import { ChevronDownIcon, KeyIcon, LogOutIcon, UserIcon } from '@/components/common/icons/Icons';
import { cn } from '@/lib/utils/cn';
import styles from './AdminProfileMenu.module.scss';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AdminProfileMenu() {
  const user = useAppSelector(selectSessionUser);
  const logout = useAdminLogout();
  const displayName = user?.name ?? 'Admin';

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={styles.trigger} aria-label="Admin account menu">
          <span className={styles.avatar}>{getInitials(displayName)}</span>
          <span className={styles.name}>{displayName}</span>
          <ChevronDownIcon width={14} height={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} align="end" sideOffset={8}>
          <Link href={ROUTES.adminUpdatePassword} className={styles.item}>
            <KeyIcon width={16} height={16} />
            Update Password
          </Link>
          <Link href={ROUTES.adminProfile} className={styles.item}>
            <UserIcon width={16} height={16} />
            Profile
          </Link>
          <div className={styles.separator} />
          <button type="button" className={cn(styles.item, styles.logoutItem)} onClick={logout}>
            <LogOutIcon width={16} height={16} />
            Logout
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
