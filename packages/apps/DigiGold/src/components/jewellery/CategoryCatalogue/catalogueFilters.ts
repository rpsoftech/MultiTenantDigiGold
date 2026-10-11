import type { Product } from '@/features/marketplace/marketplace.types';

// Filters for one category's designs. Ranges (weight, price) use fixed buckets; attribute
// filters (carat, colour, ...) offer exactly the values the loaded designs carry, so a real
// catalogue's values are always filterable and no option can only ever match nothing.

export type FilterKey =
  | 'weight'
  | 'price'
  | 'carat'
  | 'color'
  | 'designType'
  | 'gender'
  | 'collection'
  | 'gifts';

export const FILTER_KEYS: FilterKey[] = [
  'weight',
  'price',
  'carat',
  'color',
  'designType',
  'gender',
  'collection',
  'gifts',
];

export type FilterOption = {
  label: string;
  value: string;
  test: (product: Product) => boolean;
};

export type FilterGroup = {
  key: FilterKey;
  label: string;
  options: FilterOption[];
  collapsible: boolean;
};

export type SelectedFilters = Partial<Record<FilterKey, string[]>>;

const WEIGHT_BUCKETS: FilterOption[] = [
  { label: 'Under 10 gm', value: '0-10', test: (p) => p.weight < 10 },
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
  { label: 'Over 50 gm', value: '50-plus', test: (p) => p.weight > 50 },
];

const PRICE_BUCKETS: FilterOption[] = [
  { label: 'Up to 1,00,000', value: '0-100000', test: (p) => p.price < 100000 },
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
];

const ATTRIBUTE_GROUPS: {
  key: Exclude<FilterKey, 'weight' | 'price'>;
  label: string;
  collapsible: boolean;
}[] = [
  { key: 'carat', label: 'Carat', collapsible: false },
  { key: 'color', label: 'Color', collapsible: false },
  { key: 'designType', label: 'Design Types', collapsible: true },
  { key: 'gender', label: 'Gender', collapsible: false },
  { key: 'collection', label: 'Collection', collapsible: true },
  { key: 'gifts', label: 'Gifts', collapsible: false },
];

const compareLabels = (a: string, b: string) =>
  a.localeCompare(b, 'en', { numeric: true });

// Only filters that can narrow the list: a group needs at least two options that each
// match some design.
export function buildFilterGroups(products: Product[]): FilterGroup[] {
  const rangeGroups: FilterGroup[] = [
    {
      key: 'weight',
      label: 'Weight',
      options: WEIGHT_BUCKETS,
      collapsible: false,
    },
    {
      key: 'price',
      label: 'Price',
      options: PRICE_BUCKETS,
      collapsible: false,
    },
  ];
  const ranges = rangeGroups.map((group) => ({
    ...group,
    options: group.options.filter((option) => products.some(option.test)),
  }));

  const attributes: FilterGroup[] = ATTRIBUTE_GROUPS.map(
    ({ key, label, collapsible }) => {
      const values = [
        ...new Set(
          products.map((product) => product[key].trim()).filter(Boolean),
        ),
      ].sort(compareLabels);
      return {
        key,
        label,
        collapsible,
        options: values.map((value) => ({
          label: value,
          value,
          test: (product: Product) => product[key].trim() === value,
        })),
      };
    },
  );

  return [...ranges, ...attributes].filter(
    (group) => group.options.length >= 2,
  );
}

// A design passes when, in every group with a selection, it matches one of the selected
// options. Selections no current option knows (e.g. from an old link) are ignored.
export function applyFilters(
  products: Product[],
  groups: FilterGroup[],
  selected: SelectedFilters,
): Product[] {
  return products.filter((product) =>
    groups.every((group) => {
      const active = group.options.filter((option) =>
        selected[group.key]?.includes(option.value),
      );
      return (
        active.length === 0 || active.some((option) => option.test(product))
      );
    }),
  );
}

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to high' },
  { value: 'price-high', label: 'Price: High to low' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export function isSortValue(value: string | null): value is SortValue {
  return SORT_OPTIONS.some((option) => option.value === value);
}

// "Featured" keeps the catalogue's own order. Array.prototype.sort is stable, so ties keep
// that order too.
export function sortProducts(products: Product[], sort: SortValue): Product[] {
  const sorted = [...products];
  if (sort === 'price-low') sorted.sort((a, b) => a.price - b.price);
  if (sort === 'price-high') sorted.sort((a, b) => b.price - a.price);
  if (sort === 'newest')
    sorted.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  return sorted;
}

// "22KT Gold" -> "22KT", in ascending purity, for the intro line.
export function purityList(products: Product[]): string[] {
  return [
    ...new Set(
      products
        .map((product) => product.carat.replace(/\s*gold\s*$/i, '').trim())
        .filter(Boolean),
    ),
  ].sort(compareLabels);
}

export function selectedFromParams(params: URLSearchParams): SelectedFilters {
  const selected: SelectedFilters = {};
  for (const key of FILTER_KEYS) {
    const values = params.getAll(key);
    if (values.length) selected[key] = values;
  }
  return selected;
}

export function paramsFromState(
  selected: SelectedFilters,
  sort: SortValue,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    for (const value of selected[key] ?? []) params.append(key, value);
  }
  if (sort !== 'featured') params.set('sort', sort);
  return params;
}
