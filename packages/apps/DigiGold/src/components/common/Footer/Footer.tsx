'use client';

import Link from 'next/link';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { Logo } from '@/components/common/Logo/Logo';
import styles from './Footer.module.scss';

const LEGAL_LINKS = ['Privacy Policy', 'Terms of Service', 'Compliance', 'Security', 'FAQ'];

export function Footer() {
  const tenantConfig = useTenantConfig();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Logo className={styles.brand} height={20} />

        <nav className={styles.links} aria-label="Legal">
          {LEGAL_LINKS.map((label) => (
            <Link key={label} href="#" className={styles.link}>
              {label}
            </Link>
          ))}
        </nav>

        <span className={styles.copyright}>
          © {year} {tenantConfig?.displayName ?? 'DigiGold'}. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
