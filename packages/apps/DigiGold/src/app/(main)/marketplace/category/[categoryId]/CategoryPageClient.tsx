'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon, HeartIcon } from '@/components/common/icons/Icons';
import { Loader } from '@/components/common/Loader/Loader';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { marketplaceService } from '@/features/marketplace/marketplace.service';
import type { Product } from '@/features/marketplace/marketplace.types';
import styles from './CategoryPage.module.scss';

type FilterKey = 'weight' | 'price' | 'carat' | 'color' | 'category' | 'designType' | 'gender' | 'collection' | 'gifts';

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

const CATEGORY_FILTERS = [
  'Anklets',
  'Bangles',
  'Bracelet',
  'Chain',
  'Chain Pendant',
  'Kada',
  'Watch',
  'Tanmaniya',
  'Pendant Set',
  'Necklace',
  'Rings',
];

const filterGroups: FilterGroup[] = [
  {
    key: 'weight',
    label: 'Weight',
    options: [
      { label: '10-20 gm', value: '10-20', test: (product) => product.weight >= 10 && product.weight <= 20 },
      { label: '20-35 gm', value: '20-35', test: (product) => product.weight > 20 && product.weight <= 35 },
      { label: '35-50 gm', value: '35-50', test: (product) => product.weight > 35 && product.weight <= 50 },
      { label: '50-155 gm', value: '50-155', test: (product) => product.weight > 50 && product.weight <= 155 },
    ],
  },
  {
    key: 'price',
    label: 'Price',
    options: [
      { label: '1,00,000 to 3,00,000', value: '100000-300000', test: (product) => product.price >= 100000 && product.price <= 300000 },
      { label: '3,00,000 to 5,00,000', value: '300000-500000', test: (product) => product.price > 300000 && product.price <= 500000 },
      { label: '5,00,000 to 8,00,000', value: '500000-800000', test: (product) => product.price > 500000 && product.price <= 800000 },
      { label: '8,00,000 to 10,00,000', value: '800000-1000000', test: (product) => product.price > 800000 && product.price <= 1000000 },
      { label: '10,00,000 Above', value: '1000000-plus', test: (product) => product.price > 1000000 },
    ],
  },
  {
    key: 'carat',
    label: 'Carat',
    options: ['18KT Gold', '22KT Gold', '9KT Gold'].map((value) => ({ label: value, value, test: (product: Product) => product.carat === value })),
  },
  {
    key: 'color',
    label: 'Color',
    options: ['Rose', 'Yellow'].map((value) => ({ label: value, value, test: (product: Product) => product.color === value })),
  },
  {
    key: 'category',
    label: 'Category',
    collapsible: true,
    options: CATEGORY_FILTERS.map((value) => ({ label: value, value, test: (product: Product) => product.category === value })),
  },
  {
    key: 'designType',
    label: 'Design Types',
    collapsible: true,
    options: ['Ball Design', 'Colour Stone', 'Dailywear Collection', 'Evil Eyes Collection', 'Flower Collection'].map((value) => ({ label: value, value, test: (product: Product) => product.designType === value })),
  },
  {
    key: 'gender',
    label: 'Gender',
    options: [{ label: 'Ladies', value: 'Ladies', test: (product: Product) => product.gender === 'Ladies' }],
  },
  {
    key: 'collection',
    label: 'Collection',
    collapsible: true,
    options: ['Antique Collection', 'Daily Wear Jewellery', 'Diamond Jewellery', 'Festive', 'Italian Collection'].map((value) => ({ label: value, value, test: (product: Product) => product.collection === value })),
  },
  {
    key: 'gifts',
    label: 'Gifts',
    options: ['For Her', 'For Him'].map((value) => ({ label: value, value, test: (product: Product) => product.gifts === value })),
  },
];

const titleFromId = (categoryId: string) =>
  categoryId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to high' },
  { value: 'price-high', label: 'Price: High to low' },
];

export default function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const routeParams = use(params);
  const categoryId = routeParams.categoryId;
  const categoryTitle = titleFromId(categoryId);
  const [selected, setSelected] = useState<Partial<Record<FilterKey, string[]>>>({
    category: [categoryTitle],
  });
  const [sort, setSort] = useState('relevance');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSortOpen) return;

    const closeSortMenu = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSortOpen(false);
    };

    document.addEventListener('mousedown', closeSortMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeSortMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isSortOpen]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['category']);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['marketplace', 'category-products', categoryId],
    queryFn: () => marketplaceService.getCategoryProducts(categoryId),
  });

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) =>
      filterGroups.every((group) => {
        const values = selected[group.key];
        if (!values?.length) return true;
        return values.some((value) => group.options.find((option) => option.value === value)?.test(product));
      }),
    );

    return [...filtered].sort((first, second) => {
      if (sort === 'price-low') return first.price - second.price;
      if (sort === 'price-high') return second.price - first.price;
      if (sort === 'newest') return Number(second.isNew) - Number(first.isNew);
      return first.id.localeCompare(second.id);
    });
  }, [products, selected, sort]);

  const toggleFilter = (key: FilterKey, value: string) => {
    setSelected((current) => {
      const values = current[key] ?? [];
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, [key]: nextValues };
    });
  };

  const clearFilters = () => setSelected({});
  const activeFilterCount = Object.values(selected).reduce((count, values) => count + (values?.length ?? 0), 0);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.heroKicker}>Home / Jewellery / <strong>{categoryTitle}</strong></div>
          <div className={styles.titleRow}>
            <div>
              <h1>{categoryTitle}</h1>
              <p>Exquisite {categoryTitle.toLowerCase()} crafted in 18K and 22K gold, hand-set with certified diamonds and precious gemstones.</p>
            </div>
            <span className={styles.heroBadge}>◇ {products.length} Exclusive {products.length === 1 ? 'Design' : 'Designs'} Found</span>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <aside className={styles.filters}>
          <div className={styles.filterHeader}>
            <span>Filters</span>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters}>Clear all</button>}
          </div>
          {filterGroups.map((group) => {
            const isExpanded = !group.collapsible || expandedGroups.includes(group.key);
            return (
              <section className={styles.filterGroup} key={group.key}>
                <button
                  type="button"
                  className={styles.groupTitle}
                  onClick={() => group.collapsible && setExpandedGroups((current) => current.includes(group.key) ? current.filter((item) => item !== group.key) : [...current, group.key])}
                  aria-expanded={isExpanded}
                >
                  {group.label}
                  {group.collapsible && <ChevronDownIcon className={isExpanded ? styles.chevronOpen : ''} width={16} height={16} />}
                </button>
                {isExpanded && <div className={styles.options}>
                  {group.options.map((option) => (
                    <label className={styles.option} key={option.value}>
                      <input type="checkbox" checked={selected[group.key]?.includes(option.value) ?? false} onChange={() => toggleFilter(group.key, option.value)} />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>}
                {group.collapsible && !isExpanded && <button type="button" className={styles.showMore} onClick={() => setExpandedGroups((current) => [...current, group.key])}>Show More</button>}
              </section>
            );
          })}
        </aside>

        <section className={styles.results}>
          <div className={styles.toolbar}>
            <span>Showing <strong>{filteredProducts.length}</strong> products</span>
            <div className={styles.sort}>
              <span>Sort By:</span>
              <div className={styles.sortMenu} ref={sortMenuRef}>
                <button
                  type="button"
                  className={styles.sortTrigger}
                  aria-haspopup="listbox"
                  aria-expanded={isSortOpen}
                  onClick={() => setIsSortOpen((current) => !current)}
                >
                  {sortOptions.find((option) => option.value === sort)?.label}
                  <ChevronDownIcon className={isSortOpen ? styles.chevronOpen : ''} width={16} height={16} />
                </button>
                {isSortOpen && <div className={styles.sortOptions} role="listbox" aria-label="Sort products">
                  {sortOptions.map((option) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={sort === option.value}
                      className={styles.sortOption}
                      key={option.value}
                      onClick={() => {
                        setSort(option.value);
                        setIsSortOpen(false);
                      }}
                    >
                      <span>{option.label}</span>
                      {sort === option.value && <span className={styles.sortCheck}>✓</span>}
                    </button>
                  ))}
                </div>}
              </div>
            </div>
          </div>

          {isLoading && <div className={styles.loading}><Loader label="Loading designs" /></div>}
          {!isLoading && filteredProducts.length > 0 && <div className={styles.grid}>
            {filteredProducts.map((product) => <ProductTile key={product.id} product={product} />)}
          </div>}
          {!isLoading && filteredProducts.length === 0 && <div className={styles.empty}><strong>No designs match these filters.</strong><button type="button" onClick={clearFilters}>Clear filters</button></div>}
        </section>
      </div>
    </main>
  );
}

function ProductTile({ product }: { product: Product }) {
  const [isFavorite, setIsFavorite] = useState(false);

  return <article className={styles.productCard}>
    <div className={styles.imageWrap}>
      <Link href={product.url} className={styles.imageLink} aria-label={`View ${product.title}`}>
        <Image src={product.imageUrl} alt={product.imageAlt} fill sizes="(min-width: 1200px) 24vw, (min-width: 700px) 32vw, 90vw" />
      </Link>
      <Link href={product.url} className={styles.quickView}>Quick View</Link>
      <button
        type="button"
        className={`${styles.favorite} ${isFavorite ? styles.favoriteActive : ''}`}
        aria-label={isFavorite ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
        aria-pressed={isFavorite}
        onClick={() => setIsFavorite((current) => !current)}
      >
        <HeartIcon className={isFavorite ? styles.heartFilled : ''} width={25} height={25} />
      </button>
    </div>
    <div className={styles.productInfo}>
      <div className={styles.productFooter}>
        <strong>{formatCurrency(product.price, product.currency)}</strong>
      </div>
      <Link href={product.url} className={styles.productTitle}>{product.title}</Link>
      <span className={styles.productId}>{product.code}</span>
    </div>
  </article>;
}