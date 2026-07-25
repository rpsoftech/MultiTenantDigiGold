'use client';

import Link from 'next/link';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { Logo } from '@/components/common/Logo/Logo';
import { ICON_REGISTRY } from '@/components/common/icons/iconRegistry';
import { useFooterConfig } from './useFooterConfig';
import styles from './Footer.module.scss';

export function Footer() {
  const tenantConfig = useTenantConfig();
  const { columns } = useFooterConfig();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <Logo className={styles.brand} height={20} />
          <span className={styles.copyright}>
            © {year} {tenantConfig?.displayName ?? 'DigiGold'}. All rights reserved.
          </span>
        </div>

        <div className={styles.columns}>
          {columns.map((column) => (
            <nav key={column.id} className={styles.column} aria-label={column.label}>
              <span className={styles.columnTitle}>{column.label}</span>
              {column.links.map((link) => {
                const Icon = link.icon ? ICON_REGISTRY[link.icon] : null;
                return (
                  <Link
                    key={link.id}
                    href={link.url}
                    target={link.target ?? '_self'}
                    rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                    className={styles.link}
                  >
                    {Icon && <Icon width={14} height={14} />}
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
