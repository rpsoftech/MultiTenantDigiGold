import { imageUrl, internalPath, optionalText, text } from './layout.props';

// Parsers for the content sections (promo carousel, categories, essentials, trending
// jewellery). Each one accepts the tenant's own content from the block props and returns
// only what is safe to render. A list that is missing, not an array, or has no valid item
// comes back as undefined, which tells the section to keep its built-in content.

const MAX_SLIDES = 10;
const MAX_CATEGORIES = 20;
const MAX_ESSENTIALS = 6;
const MAX_PRODUCTS = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keeps the valid items in saved order, up to `max`, with unique ids (React keys).
function parseItems<T extends { id: string }>(
  raw: unknown,
  max: number,
  parseItem: (
    item: Record<string, unknown>,
    fallbackId: string,
  ) => Omit<T, 'id'> | null,
): T[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const items: T[] = [];
  const usedIds = new Set<string>();
  for (const [index, entry] of raw.entries()) {
    if (items.length >= max) break;
    if (!isRecord(entry)) continue;

    const parsed = parseItem(entry, `item-${index + 1}`);
    if (!parsed) continue;

    let id = optionalText(entry.id, 80) ?? `item-${index + 1}`;
    for (let n = 2; usedIds.has(id); n += 1)
      id = `${optionalText(entry.id, 70) ?? 'item'}-${n}`;
    usedIds.add(id);
    items.push({ id, ...parsed } as T);
  }
  return items.length ? items : undefined;
}

// ---- Promo carousel -------------------------------------------------------------------

export type PromoSlideData = {
  id: string;
  imageUrl: string;
  imageAlt: string;
  linkUrl?: string;
};
export type PromoCarouselProps = {
  slides?: PromoSlideData[];
  autoplayIntervalMs?: number;
};

export function parsePromoCarouselProps(
  raw: Record<string, unknown>,
): PromoCarouselProps {
  const interval = raw.autoplayIntervalMs;
  return {
    slides: parseItems<PromoSlideData>(raw.slides, MAX_SLIDES, (item) => {
      const url = imageUrl(item.imageUrl);
      if (!url) return null;
      return {
        imageUrl: url,
        imageAlt: text(item.imageAlt, 120, 'Promotion'),
        linkUrl: internalPath(item.linkUrl) ?? undefined,
      };
    }),
    // Fast enough to stay lively, slow enough to read and not a motion hazard.
    autoplayIntervalMs:
      typeof interval === 'number' && Number.isFinite(interval)
        ? Math.min(15_000, Math.max(2_000, interval))
        : undefined,
  };
}

// ---- Category carousel ----------------------------------------------------------------

export type CategoryData = {
  id: string;
  label: string;
  imageUrl: string;
  imageAlt: string;
  url: string;
};
export type CategoryCarouselProps = {
  title?: string;
  categories?: CategoryData[];
};

export function parseCategoryCarouselProps(
  raw: Record<string, unknown>,
): CategoryCarouselProps {
  return {
    title: optionalText(raw.title, 80) ?? undefined,
    categories: parseItems<CategoryData>(
      raw.categories,
      MAX_CATEGORIES,
      (item) => {
        const label = optionalText(item.label, 60);
        const url = internalPath(item.url);
        const image = imageUrl(item.imageUrl);
        if (!label || !url || !image) return null;
        return {
          label,
          url,
          imageUrl: image,
          imageAlt: text(item.imageAlt, 120, label),
        };
      },
    ),
  };
}

// ---- Dashboard essentials -------------------------------------------------------------

const ESSENTIAL_ICONS = ['wallet', 'coins', 'gem'] as const;
const ESSENTIAL_MODULES = ['home', 'trading', 'vault', 'ecommerce'] as const;

export type EssentialData = {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: (typeof ESSENTIAL_ICONS)[number];
  module?: (typeof ESSENTIAL_MODULES)[number];
};
export type DashboardEssentialsProps = {
  title?: string;
  items?: EssentialData[];
};

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((option) => option === value);
}

export function parseDashboardEssentialsProps(
  raw: Record<string, unknown>,
): DashboardEssentialsProps {
  return {
    title: optionalText(raw.title, 80) ?? undefined,
    items: parseItems<EssentialData>(raw.items, MAX_ESSENTIALS, (item) => {
      const title = optionalText(item.title, 60);
      const url = internalPath(item.url);
      if (!title || !url) return null;
      return {
        title,
        url,
        description: text(item.description, 120, ''),
        icon: oneOf(item.icon, ESSENTIAL_ICONS) ?? 'gem',
        module: oneOf(item.module, ESSENTIAL_MODULES),
      };
    }),
  };
}

// ---- Trending jewellery ---------------------------------------------------------------

export type TrendingProductData = {
  id: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  price: number;
  currency: string;
  isNew: boolean;
  // Where "View details" goes; without it the card links to the catalogue page for its id.
  href?: string;
};
export type TrendingJewelryProps = {
  title?: string;
  subtitle?: string;
  viewAllUrl?: string;
  viewAllLabel?: string;
  products?: TrendingProductData[];
};

export function parseTrendingJewelryProps(
  raw: Record<string, unknown>,
): TrendingJewelryProps {
  return {
    title: optionalText(raw.title, 80) ?? undefined,
    subtitle: optionalText(raw.subtitle, 160) ?? undefined,
    viewAllUrl: internalPath(raw.viewAllUrl) ?? undefined,
    viewAllLabel: optionalText(raw.viewAllLabel, 30) ?? undefined,
    products: parseItems<TrendingProductData>(
      raw.products,
      MAX_PRODUCTS,
      (item) => {
        const title = optionalText(item.title, 80);
        const image = imageUrl(item.imageUrl);
        const price = item.price;
        if (
          !title ||
          !image ||
          typeof price !== 'number' ||
          !Number.isFinite(price) ||
          price < 0
        ) {
          return null;
        }
        const currency =
          typeof item.currency === 'string'
            ? item.currency.trim().toUpperCase()
            : '';
        return {
          title,
          imageUrl: image,
          imageAlt: text(item.imageAlt, 120, title),
          price,
          currency: /^[A-Z]{3}$/.test(currency) ? currency : 'INR',
          isNew: item.isNew === true,
          href: internalPath(item.href) ?? undefined,
        };
      },
    ),
  };
}
