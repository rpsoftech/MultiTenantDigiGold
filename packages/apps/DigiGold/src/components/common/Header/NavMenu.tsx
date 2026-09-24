'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDownIcon } from '@/components/common/icons/Icons';
import { cn } from '@/lib/utils/cn';
import { ICON_REGISTRY } from '@/components/common/icons/iconRegistry';
import type { MenuItem } from './Header.types';
import styles from './NavMenu.module.scss';

function isItemActive(pathname: string, item: MenuItem): boolean {
  if (item.url !== '#' && pathname === item.url) return true;
  return item.children?.some((child) => isItemActive(pathname, child)) ?? false;
}

function NavLink({ item, active }: { item: MenuItem; active: boolean }) {
  const Icon = item.icon ? ICON_REGISTRY[item.icon] : null;

  return (
    <Link
      href={item.url}
      target={item.target ?? '_self'}
      rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
      className={cn(styles.navLink, active && styles.navLinkActive)}
    >
      {Icon && <Icon width={16} height={16} />}
      {item.label}
    </Link>
  );
}

function NavMenuItem({ item }: { item: MenuItem }) {
  const pathname = usePathname();
  const active = isItemActive(pathname, item);

  if (!item.children?.length) {
    return (
      <li className={styles.navItem}>
        <NavLink item={item} active={active} />
      </li>
    );
  }

  return (
    <li className={styles.navItem}>
      <Popover.Root>
        <Popover.Trigger className={cn(styles.navTrigger, active && styles.navLinkActive)}>
          {item.label}
          <ChevronDownIcon width={14} height={14} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={styles.dropdown} align="start" sideOffset={8}>
            <ul className={styles.dropdownList}>
              {item.children.map((child) => (
                <NavMenuItem key={child.id} item={child} />
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </li>
  );
}

export function NavMenu({ items }: { items: MenuItem[] }) {
  if (!items.length) return null;

  return (
    <nav className={styles.nav} aria-label="Primary">
      <ul className={styles.navList}>
        {items.map((item) => (
          <NavMenuItem key={item.id} item={item} />
        ))}
      </ul>
    </nav>
  );
}
