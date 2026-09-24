'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDownIcon, CloseIcon } from '@/components/common/icons/Icons';
import { cn } from '@/lib/utils/cn';
import { ICON_REGISTRY } from '@/components/common/icons/iconRegistry';
import { HeaderActionLink } from './HeaderActionLink';
import type { HeaderAction, MenuItem } from './Header.types';
import styles from './MobileNav.module.scss';

function MobileNavItem({ item, onNavigate }: { item: MenuItem; onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const active = pathname === item.url;
  const Icon = item.icon ? ICON_REGISTRY[item.icon] : null;

  if (item.children?.length) {
    return (
      <li className={styles.item}>
        <button
          type="button"
          className={styles.parentButton}
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <span className={styles.label}>
            {Icon && <Icon width={16} height={16} />}
            {item.label}
          </span>
          <ChevronDownIcon width={16} height={16} className={cn(styles.chevron, expanded && styles.chevronOpen)} />
        </button>
        {expanded && (
          <ul className={styles.children}>
            {item.children.map((child) => (
              <MobileNavItem key={child.id} item={child} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li className={styles.item}>
      <Link
        href={item.url}
        target={item.target ?? '_self'}
        rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
        className={cn(styles.link, active && styles.linkActive)}
        onClick={onNavigate}
      >
        {Icon && <Icon width={16} height={16} />}
        {item.label}
      </Link>
    </li>
  );
}

export type MobileNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menus: MenuItem[];
  actions: HeaderAction[];
};

export function MobileNav({ open, onOpenChange, menus, actions }: MobileNavProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <div className={styles.panelHeader}>
            <Dialog.Title className={styles.title}>Menu</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Close menu">
              <CloseIcon width={20} height={20} />
            </Dialog.Close>
          </div>

          <ul className={styles.list}>
            {menus.map((item) => (
              <MobileNavItem key={item.id} item={item} onNavigate={close} />
            ))}
          </ul>

          {actions.length > 0 && (
            <div className={styles.actions}>
              {actions.map((action) => (
                <HeaderActionLink
                  key={action.id}
                  action={action}
                  className={styles.actionOverride}
                  onClick={close}
                />
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
