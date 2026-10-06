'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/common/Button/Button';
import { ChevronDownIcon } from '@/components/common/icons/Icons';
import { Loader } from '@/components/common/Loader/Loader';
import { JewelleryUnavailable } from '@/components/jewellery/JewelleryUnavailable/JewelleryUnavailable';
import { SampleCatalogueNotice } from '@/components/jewellery/SampleCatalogueNotice/SampleCatalogueNotice';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useTenantResolved } from '@/features/tenant/hooks/useTenantResolved';
import {
  JEWELLERY_CATEGORIES,
  jewelleryCategoryHref,
  jewelleryCategoryLabel,
  jewelleryProductHref,
} from '@/features/marketplace/marketplace.catalogue';
import { marketplaceService } from '@/features/marketplace/marketplace.service';
import { isJewellerySample } from '@/features/marketplace/marketplace.sample';
import type { Product } from '@/features/marketplace/marketplace.types';
import { describeApiError } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import styles from './CategoryCatalogue.module.scss';

type FilterKey =
  | 'weight'
  | 'price'
  | 'carat'
  | 'color'
  | 'designType'
  | 'gender'
  | 'collection'
  | 'gifts';

type FilterOption = {
  label: string;
  value: string;
  test: (product: Product) => boolean;
};

type FilterGroup = {
  key: FilterKey;
  label: string;
  options: FilterOption[];
  collapsible?: boolean;
};

const valueOptions = (values: string[], field: keyof Product): FilterOption[] =>
  values.map((value) => ({
    label: value,
    value,
    test: (product) => product[field] === value,
  }));

// Category is deliberately not a filter: products are loaded per category, so a "Rings"
// checkbox on the Bangles page could only ever show nothing. Categories are navigation
// (the list in the sidebar) instead.
const FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'weight',
    label: 'Weight',
    options: [
      {
        label: 'Under 10 gm',
        value: '0-10',
        test: (p) => p.weight < 10,
      },
      {
        label: '10-20 gm',
        value: '10-20',
        test: (p) => p.weight >= 10 && p.weight <= 20,
      },
      {
        label: '20-35 gm',
        value: '20-35',
        test: (p) => p.weight > 20 && p.weight <= 35,
      },
      {
        label: '35-50 gm',
        value: '35-50',
        test: (p) => p.weight > 35 && p.weight <= 50,
      },
      {
        label: 'Above 50 gm',
        value: '50-plus',
        test: (p) => p.weight > 50,
      },
    ],
  },
  {
    key: 'price',
    label: 'Price',
    options: [
      {
        label: 'Up to 1,00,000',
        value: '0-100000',
        test: (p) => p.price < 100000,
      },
      {
        label: '1,00,000 to 3,00,000',
        value: '100000-300000',
        test: (p) => p.price >= 100000 && p.price <= 300000,
      },
      {
        label: '3,00,000 to 5,00,000',
        value: '300000-500000',
        test: (p) => p.price > 300000 && p.price <= 500000,
      },
      {
        label: '5,00,000 to 8,00,000',
        value: '500000-800000',
        test: (p) => p.price > 500000 && p.price <= 800000,
      },
      {
        label: '8,00,000 to 10,00,000',
        value: '800000-1000000',
        test: (p) => p.price > 800000 && p.price <= 1000000,
      },
      {
        label: '10,00,000 Above',
        value: '1000000-plus',
        test: (p) => p.price > 1000000,
      },
    ],
  },
  {
    key: 'carat',
    label: 'Carat',
    options: valueOptions(['18KT Gold', '22KT Gold', '9KT Gold'], 'carat'),
  },
  {
    key: 'color',
    label: 'Color',
    options: valueOptions(['Rose', 'Yellow'], 'color'),
  },
  {
    key: 'designType',
    label: 'Design Types',
    collapsible: true,
    options: valueOptions(
      [
        'Ball Design',
        'Colour Stone',
        'Dailywear Collection',
        'Evil Eyes Collection',
        'Flower Collection',
      ],
      'designType',
    ),
  },
  {
    key: 'gender',
    label: 'Gender',
    options: valueOptions(['Ladies'], 'gender'),
  },
  {
    key: 'collection',
    label: 'Collection',
    collapsible: true,
    options: valueOptions(
      [
        'Antique Collection',
        'Daily Wear Jewellery',
        'Diamond Jewellery',
        'Festive',
        'Italian Collection',
      ],
      'collection',
    ),
  },
  {
    key: 'gifts',
    label: 'Gifts',
    options: valueOptions(['For Her', 'For Him'], 'gifts'),
  },
];

const SORT_OPTIONS = [
  // Keeps the catalogue's own order.
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to high' },
  { value: 'price-high', label: 'Price: High to low' },
];

export function CategoryCatalogue({ categoryId }: { categoryId: string }) {
  const tenantConfig = useTenantConfig();
  const categoryTitle = jewelleryCategoryLabel(categoryId) ?? categoryId;
  const [selected, setSelected] = useState<
    Partial<Record<FilterKey, string[]>>
  >({});
  const [sort, setSort] = useState('featured');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const sortOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Until the host's tenant config arrives, the store holds the build-time default, so
  // don't show (or fetch) the catalogue for a tenant that may have ecommerce switched off.
  const tenantResolved = useTenantResolved();
  const ecommerceEnabled = tenantConfig?.activeModules.ecommerce ?? true;

  useEffect(() => {
    if (!isSortOpen) return;

    const closeSortMenu = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node))
        setIsSortOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSortOpen(false);
        sortTriggerRef.current?.focus();
      }
    };

    const selectedIndex = SORT_OPTIONS.findIndex(
      (option) => option.value === sort,
    );
    sortOptionRefs.current[Math.max(selectedIndex, 0)]?.focus();

    document.addEventListener('mousedown', closeSortMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeSortMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isSortOpen, sort]);

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

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) =>
      FILTER_GROUPS.every((group) => {
        const values = selected[group.key];
        if (!values?.length) return true;
        return values.some((value) =>
          group.options.find((option) => option.value === value)?.test(product),
        );
      }),
    );

    return [...filtered].sort((first, second) => {
      if (sort === 'price-low') return first.price - second.price;
      if (sort === 'price-high') return second.price - first.price;
      if (sort === 'newest') return Number(second.isNew) - Number(first.isNew);
      return 0;
    });
  }, [products, selected, sort]);

  if (!tenantResolved) {
    return (
      <div className={styles.loading}>
        <Loader label="Loading designs" />
      </div>
    );
  }
  if (!ecommerceEnabled) return <JewelleryUnavailable />;

  const moveSortFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const options = sortOptionRefs.current;
    const current = options.findIndex(
      (option) => option === document.activeElement,
    );
    const last = SORT_OPTIONS.length - 1;
    const next: Record<string, number> = {
      ArrowDown: current >= last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    options[next[event.key]]?.focus();
  };

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
  const activeFilterCount = Object.values(selected).reduce(
    (count, values) => count + (values?.length ?? 0),
    0,
  );

  const renderResults = () => {
    if (isLoading) {
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
              <p>Explore our {categoryTitle.toLowerCase()} designs.</p>
            </div>
            {!isLoading && !isError && (
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
        <aside className={styles.filters}>
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

          <div className={styles.filterHeader}>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters}>
                Clear all
              </button>
            )}
          </div>
          {FILTER_GROUPS.map((group) => {
            const isExpanded =
              !group.collapsible || expandedGroups.includes(group.key);
            return (
              <section className={styles.filterGroup} key={group.key}>
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
              </section>
            );
          })}
        </aside>

        <section className={styles.results}>
          <div className={styles.toolbar}>
            <span>
              Showing <strong>{filteredProducts.length}</strong> products
            </span>
            <div className={styles.sort}>
              <span>Sort By:</span>
              <div className={styles.sortMenu} ref={sortMenuRef}>
                <button
                  ref={sortTriggerRef}
                  type="button"
                  className={styles.sortTrigger}
                  aria-haspopup="listbox"
                  aria-expanded={isSortOpen}
                  onClick={() => setIsSortOpen((current) => !current)}
                >
                  {SORT_OPTIONS.find((option) => option.value === sort)?.label}
                  <ChevronDownIcon
                    className={isSortOpen ? styles.chevronOpen : ''}
                    width={16}
                    height={16}
                  />
                </button>
                {isSortOpen && (
                  <div
                    className={styles.sortOptions}
                    role="listbox"
                    aria-label="Sort products"
                    onKeyDown={moveSortFocus}
                  >
                    {SORT_OPTIONS.map((option, index) => (
                      <button
                        ref={(element) => {
                          sortOptionRefs.current[index] = element;
                        }}
                        type="button"
                        role="option"
                        aria-selected={sort === option.value}
                        className={styles.sortOption}
                        key={option.value}
                        onClick={() => {
                          setSort(option.value);
                          setIsSortOpen(false);
                          sortTriggerRef.current?.focus();
                        }}
                      >
                        <span>{option.label}</span>
                        {sort === option.value && (
                          <span className={styles.sortCheck}>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
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
