// Single source for the jewellery catalogue's categories and URLs. The category pages are
// statically exported (output: 'export'), so this list is also what generateStaticParams
// builds — a category missing here has no page.
export const JEWELLERY_CATEGORIES = [
  { id: 'anklets', label: 'Anklets' },
  { id: 'bangles', label: 'Bangles' },
  { id: 'bracelet', label: 'Bracelet' },
  { id: 'chain', label: 'Chain' },
  { id: 'chain-pendant', label: 'Chain Pendant' },
  { id: 'kada', label: 'Kada' },
  { id: 'watch', label: 'Watch' },
  { id: 'tanmaniya', label: 'Tanmaniya' },
  { id: 'pendant-set', label: 'Pendant Set' },
  { id: 'necklace', label: 'Necklace' },
  { id: 'rings', label: 'Rings' },
] as const;

export type JewelleryCategoryId = (typeof JEWELLERY_CATEGORIES)[number]['id'];

// Where /jewellery lands when no category is chosen.
export const DEFAULT_JEWELLERY_CATEGORY_ID: JewelleryCategoryId = 'bangles';

export function jewelleryCategoryLabel(categoryId: string): string | null {
  return (
    JEWELLERY_CATEGORIES.find((category) => category.id === categoryId)
      ?.label ?? null
  );
}

export function jewelleryCategoryHref(categoryId: string): string {
  return `/jewellery/category/${categoryId}`;
}

// Product detail is a single client-rendered page keyed by query string rather than a
// /jewellery/[productId] route: a static export can only serve dynamic segments it
// enumerated at build time, which would tie the catalogue to whatever existed at build and
// bake prices into HTML. The frontend owns this URL, so it's built from the id rather than
// read from the product payload.
export function jewelleryProductHref(productId: string): string {
  return `/jewellery/product?id=${encodeURIComponent(productId)}`;
}
