'use client';

import Link from 'next/link';
import { useSession } from '@/features/auth/hooks/useSession';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { ArrowLeftIcon } from '@/components/common/icons/Icons';
import { ROUTES } from '@/lib/constants/routes';
import { LEGAL_PLACEHOLDER_VALUES } from '@/features/legal/legal.mock';
import {
  STORE_NAME_PLACEHOLDER,
  type LegalBlock,
  type LegalContent,
} from '@/features/legal/legal.types';
import styles from './LegalDocument.module.scss';

export type LegalDocumentProps = {
  content: LegalContent;
};

export function LegalDocument({ content }: LegalDocumentProps) {
  const { isAuthenticated } = useSession();
  const tenantConfig = useTenantConfig();
  const storeName = tenantConfig?.displayName ?? 'DigiGold';
  // Unknown placeholders are left as written.
  const fill = (text: string) =>
    text.replace(/\[[^\]]+\]/g, (token) =>
      token === STORE_NAME_PLACEHOLDER
        ? storeName
        : (LEGAL_PLACEHOLDER_VALUES[token] ?? token),
    );

  const renderBlock = (block: LegalBlock, index: number) => {
    switch (block.kind) {
      case 'paragraph':
        return (
          <p key={index} className={styles.paragraph}>
            {fill(block.text)}
          </p>
        );
      case 'list':
        return (
          <ul key={index} className={styles.list}>
            {block.items.map((item) => (
              <li key={item.label ?? item.text}>
                {item.label && <strong>{item.label}: </strong>}
                {fill(item.text)}
              </li>
            ))}
          </ul>
        );
      case 'link':
        return (
          <p key={index} className={styles.paragraph}>
            <a
              href={block.href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {block.label}
            </a>
          </p>
        );
      case 'details':
        return (
          <dl key={index} className={styles.details}>
            {block.rows.map((row) => (
              <div key={row.label} className={styles.detailRow}>
                <dt>{row.label}</dt>
                <dd>{fill(row.value)}</dd>
              </div>
            ))}
          </dl>
        );
    }
  };

  return (
    <article className={styles.page}>
      <Link
        href={isAuthenticated ? ROUTES.home : ROUTES.login}
        className={styles.backLink}
      >
        <ArrowLeftIcon width={16} height={16} />
        {isAuthenticated ? 'Back to app' : 'Back to login'}
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.dates}>
          <span>Effective date: {fill(content.effectiveDate)}</span>
          <span>Last updated: {fill(content.lastUpdated)}</span>
        </p>
      </header>

      <div className={styles.body}>
        {content.sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            className={styles.section}
            aria-labelledby={`${section.id}-heading`}
          >
            <h2 id={`${section.id}-heading`} className={styles.heading}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              {section.heading}
            </h2>
            {section.blocks.map(renderBlock)}
          </section>
        ))}
      </div>
    </article>
  );
}
