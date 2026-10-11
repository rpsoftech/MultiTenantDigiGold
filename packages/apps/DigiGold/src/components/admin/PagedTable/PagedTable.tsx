'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import styles from './PagedTable.module.scss';

// Cell classes shared by the tables rendered inside PagedTable.
export { styles as pagedTableStyles };

export type PagedTableText = {
  // Loader label and the line under it.
  loadingLabel: string;
  loadingDetail: string;
  errorTitle: string;
  errorDetail: string;
  // Nothing at all (first page) and nothing on a later page.
  emptyTitle: string;
  emptyDetail: string;
  emptyPageTitle: string;
  emptyPageDetail: string;
  // Plural noun for the pagination summary, e.g. "customers".
  noun: string;
  paginationLabel: string;
};

type PagedTableProps = {
  titleId: string;
  title: string;
  description: string;
  text: PagedTableText;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  // Shows the rows-per-page select; followed by onPageChange(1), since a new page size
  // starts again from the first page. Leave it out for a fixed page size.
  onLimitChange?: (limit: number) => void;
  // Extra controls on the right of the title, e.g. a refresh button.
  actions?: ReactNode;
  // Shown between the title and the table, e.g. a search form.
  toolbar?: ReactNode;
  // Replaces the empty state built from text, e.g. for a search with no results.
  emptyState?: ReactNode;
  itemCount: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  tableLabel: string;
  // Below this width the table scrolls sideways; phones stack rows instead.
  minWidth: number;
  // The table's <thead> and <tbody>.
  children: ReactNode;
};

const PAGE_SIZES = [20, 50, 100];

// The frame shared by the admin's paged tables: title, rows per page, loading, error and
// empty states, and previous/next pagination for MainServer's page-and-limit endpoints.
export function PagedTable({
  titleId,
  title,
  description,
  text,
  page,
  limit,
  onPageChange,
  onLimitChange,
  actions,
  toolbar,
  emptyState,
  itemCount,
  hasNextPage,
  isLoading,
  isError,
  isFetching,
  onRetry,
  tableLabel,
  minWidth,
  children,
}: PagedTableProps) {
  const firstItem = (page - 1) * limit + 1;

  return (
    <section aria-labelledby={titleId}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 id={titleId} className={styles.sectionTitle}>
            {title}
          </h2>
          <p className={styles.sectionDescription}>{description}</p>
        </div>
        {actions}
        {onLimitChange && (
          <label className={styles.pageSize}>
            Rows per page
            <select
              value={limit}
              disabled={isFetching}
              onChange={(event) => {
                onLimitChange(Number(event.target.value));
                onPageChange(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {toolbar}

      <Card className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.state}>
            <Loader label={text.loadingLabel} />
            <p>{text.loadingDetail}</p>
          </div>
        ) : isError ? (
          <div className={styles.state} role="alert">
            <strong>{text.errorTitle}</strong>
            <p>{text.errorDetail}</p>
            <Button variant="outlined" onClick={onRetry} isLoading={isFetching}>
              Try again
            </Button>
          </div>
        ) : itemCount === 0 ? (
          (emptyState ?? (
            <div className={styles.state}>
              <strong>
                {page === 1 ? text.emptyTitle : text.emptyPageTitle}
              </strong>
              <p>{page === 1 ? text.emptyDetail : text.emptyPageDetail}</p>
            </div>
          ))
        ) : (
          <div className={styles.tableScroll} aria-busy={isFetching}>
            <table
              className={styles.table}
              aria-label={tableLabel}
              style={
                { '--paged-table-min-width': `${minWidth}px` } as CSSProperties
              }
            >
              {children}
            </table>
          </div>
        )}

        <nav className={styles.pagination} aria-label={text.paginationLabel}>
          <span className={styles.pageSummary} aria-live="polite">
            {isFetching
              ? `Loading ${text.noun}…`
              : isError
                ? `Page ${page}`
                : itemCount
                  ? `Showing ${firstItem}–${firstItem + itemCount - 1} ${text.noun}`
                  : `0 ${text.noun} on this page`}
          </span>
          <div className={styles.pageControls}>
            <Button
              variant="outlined"
              className={styles.pageButton}
              disabled={page === 1 || isFetching}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className={styles.pageNumber}>Page {page}</span>
            <Button
              variant="outlined"
              className={styles.pageButton}
              disabled={!hasNextPage || isFetching || isError}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      </Card>
    </section>
  );
}
