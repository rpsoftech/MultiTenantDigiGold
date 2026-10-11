'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/common/Button/Button';
import { ChevronDownIcon } from '@/components/common/icons/Icons';
import { Loader } from '@/components/common/Loader/Loader';
import { JewelleryUnavailable } from '@/components/jewellery/JewelleryUnavailable/JewelleryUnavailable';
import { ProductImage } from '@/components/jewellery/ProductImage/ProductImage';
import { SampleCatalogueNotice } from '@/components/jewellery/SampleCatalogueNotice/SampleCatalogueNotice';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useTenantResolved } from '@/features/tenant/hooks/useTenantResolved';
import { isJewellerySample } from '@/features/marketplace/marketplace.sample';
import {
  JEWELLERY_CATEGORIES,
  jewelleryCategoryHref,
  jewelleryCategoryLabel,
  jewelleryProductHref,
} from '@/features/marketplace/marketplace.catalogue';
import { marketplaceService } from '@/features/marketplace/marketplace.service';
import type { Product } from '@/features/marketplace/marketplace.types';
import { describeApiError } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  SORT_OPTIONS,
  applyFilters,
  buildFilterGroups,
  isSortValue,
  paramsFromState,
  purityList,
  selectedFromParams,
  sortProducts,
  type FilterKey,
  type SelectedFilters,
  type SortValue,
} from './catalogueFilters';
import styles from './CategoryCatalogue.module.scss';

// "9KT, 18KT and 22KT"
function joinWithAnd(items: string[]): string {
  return items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function CategoryCatalogue({ categoryId }: { categoryId: string }) {
  const tenantConfig = useTenantConfig();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryTitle = jewelleryCategoryLabel(categoryId) ?? categoryId;
  const ecommerceEnabled = tenantConfig?.activeModules.ecommerce ?? true;
  // Until this host's tenant config arrives the store holds the build-time default.
  const tenantResolved = useTenantResolved();

  // Filters and sort start from the URL (so Back from a design, or a shared link, restores
  // them) and are written back to it on every change.
  const [selected, setSelected] = useState<SelectedFilters>(() =>
    selectedFromParams(new URLSearchParams(searchParams.toString())),
  );
  const [sort, setSort] = useState<SortValue>(() => {
    const fromUrl = searchParams.get('sort');
    return isSortValue(fromUrl) ? fromUrl : 'featured';
  });
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  // Phones show the categories and filters behind a toggle, above the designs.
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const query = paramsFromState(selected, sort).toString();
    if (query === searchParams.toString()) return;
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [selected, sort, pathname, router, searchParams]);

  const {
    data: products = [],
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['marketplace', 'category-products', categoryId],
    queryFn: () => marketplaceService.getCategoryProducts(categoryId),
    enabled: tenantResolved && ecommerceEnabled,
  });

  const filterGroups = useMemo(() => buildFilterGroups(products), [products]);
  const filteredProducts = useMemo(
    () => sortProducts(applyFilters(products, filterGroups, selected), sort),
    [products, filterGroups, selected, sort],
  );
  const purities = useMemo(() => purityList(products), [products]);
  // The page itself renders (and is in the static HTML) straight away; only the designs
  // wait for this host's tenant config.
  const designsPending = !tenantResolved || isLoading;

  if (tenantResolved && !ecommerceEnabled) return <JewelleryUnavailable />;

  const toggleFilter = (key: FilterKey, value: string) => {
    setSelected((current) => {
      const values = current[key] ?? [];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      return { ...current, [key]: nextValues };
    });
  };

  const toggleGroup = (key: string) =>
    setExpandedGroups((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );

  const clearFilters = () => setSelected({});
  // Counts only selections that a current option still knows about.
  const activeFilterCount = filterGroups.reduce(
    (count, group) =>
      count +
      group.options.filter((option) =>
        selected[group.key]?.includes(option.value),
      ).length,
    0,
  );

  const renderResults = () => {
    if (designsPending) {
      return (
        <div className={styles.loading}>
          <Loader label="Loading designs" />
        </div>
      );
    }
    // Without this, a failed request rendered as "No designs match these filters".
    if (isError) {
      return (
        <div className={styles.empty} role="alert">
          <strong>We couldn&apos;t load these designs.</strong>
          <span>{describeApiError(error) ?? 'Please try again.'}</span>
          <Button
            variant="outlined"
            onClick={() => void refetch()}
            isLoading={isFetching}
          >
            Try again
          </Button>
        </div>
      );
    }
    if (products.length === 0) {
      return (
        <div className={styles.empty}>
          <strong>No designs in this category yet.</strong>
        </div>
      );
    }
    if (filteredProducts.length === 0) {
      return (
        <div className={styles.empty}>
          <strong>No designs match these filters.</strong>
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      );
    }
    return (
      <div className={styles.grid}>
        {filteredProducts.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
    );
  };

  // A <div>: MainShell already provides the page's <main>.
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <nav className={styles.heroKicker} aria-label="Breadcrumb">
            <Link href={ROUTES.home}>Home</Link> /{' '}
            <Link href={ROUTES.jewellery}>Jewellery</Link> /{' '}
            <strong>{categoryTitle}</strong>
          </nav>
          <div className={styles.titleRow}>
            <div>
              <h1>{categoryTitle}</h1>
              <p>
                Explore our {categoryTitle.toLowerCase()} designs
                {purities.length > 0 && ` in ${joinWithAnd(purities)} gold`}.
              </p>
            </div>
            {!designsPending && !isError && (
              <span className={styles.heroBadge}>
                ◇ {products.length}{' '}
                {products.length === 1 ? 'Design' : 'Designs'}
              </span>
            )}
          </div>
        </div>
      </header>

      {isJewellerySample() && (
        <div className={styles.sampleNotice}>
          <SampleCatalogueNotice />
        </div>
      )}

      <div className={styles.content}>
        <button
          type="button"
          className={styles.filtersToggle}
          aria-expanded={filtersOpen}
          aria-controls="jewellery-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <span>
            Categories &amp; filters
            {activeFilterCount > 0 && ` (${activeFilterCount})`}
          </span>
          <ChevronDownIcon
            className={filtersOpen ? styles.chevronOpen : ''}
            width={16}
            height={16}
          />
        </button>

        <aside
          id="jewellery-filters"
          className={styles.filters}
          data-open={filtersOpen}
        >
          <nav className={styles.filterGroup} aria-label="Jewellery categories">
            <span className={styles.groupTitle}>Category</span>
            <ul className={styles.categoryList}>
              {JEWELLERY_CATEGORIES.map((category) => (
                <li key={category.id}>
                  <Link
                    href={jewelleryCategoryHref(category.id)}
                    className={cn(
                      styles.categoryLink,
                      category.id === categoryId && styles.categoryLinkActive,
                    )}
                    aria-current={
                      category.id === categoryId ? 'page' : undefined
                    }
                  >
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {filterGroups.length > 0 && (
            <div className={styles.filterHeader}>
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters}>
                  Clear all
                </button>
              )}
            </div>
          )}
          {filterGroups.map((group) => {
            const isExpanded =
              !group.collapsible || expandedGroups.includes(group.key);
            return (
              // A fieldset names its checkboxes ("Carat, group"). Only a heading that
              // collapses is a button; a do-nothing button announcing "expanded" would
              // mislead screen readers.
              <fieldset className={styles.filterGroup} key={group.key}>
                <legend className={styles.groupLegend}>
                  {group.collapsible ? (
                    <button
                      type="button"
                      className={styles.groupTitle}
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={isExpanded}
                    >
                      {group.label}
                      <ChevronDownIcon
                        className={isExpanded ? styles.chevronOpen : ''}
                        width={16}
                        height={16}
                      />
                    </button>
                  ) : (
                    <span className={styles.groupTitle}>{group.label}</span>
                  )}
                </legend>
                {isExpanded && (
                  <div className={styles.options}>
                    {group.options.map((option) => (
                      <label className={styles.option} key={option.value}>
                        <input
                          type="checkbox"
                          checked={
                            selected[group.key]?.includes(option.value) ?? false
                          }
                          onChange={() => toggleFilter(group.key, option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                {group.collapsible && !isExpanded && (
                  <button
                    type="button"
                    className={styles.showMore}
                    onClick={() => toggleGroup(group.key)}
                  >
                    Show More
                  </button>
                )}
              </fieldset>
            );
          })}
        </aside>

        <section className={styles.results}>
          <div className={styles.toolbar}>
            <span aria-live="polite">
              {designsPending ? (
                'Loading designs…'
              ) : (
                <>
                  Showing <strong>{filteredProducts.length}</strong>{' '}
                  {filteredProducts.length === 1 ? 'design' : 'designs'}
                </>
              )}
            </span>
            <label className={styles.sort}>
              <span>Sort by</span>
              <select
                className={styles.sortSelect}
                value={sort}
                onChange={(event) => setSort(event.target.value as SortValue)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {renderResults()}
        </section>
      </div>
    </div>
  );
}

function ProductTile({ product }: { product: Product }) {
  const href = jewelleryProductHref(product.id);

  return (
    <article className={styles.productCard}>
      <div className={styles.imageWrap}>
        <Link
          href={href}
          className={styles.imageLink}
          aria-label={`View ${product.title}`}
        >
          <ProductImage
            src={product.imageUrl}
            alt={product.imageAlt}
            sizes="(min-width: 1200px) 24vw, (min-width: 700px) 32vw, 90vw"
          />
        </Link>
        <Link href={href} className={styles.quickView}>
          Quick View
        </Link>
      </div>
      <div className={styles.productInfo}>
        <div className={styles.productFooter}>
          <strong>{formatCurrency(product.price, product.currency)}</strong>
        </div>
        <Link href={href} className={styles.productTitle}>
          {product.title}
        </Link>
        <span className={styles.productId}>{product.code}</span>
      </div>
    </article>
  );
}
