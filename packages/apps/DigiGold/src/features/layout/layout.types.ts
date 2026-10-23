// One block of the tenant's published storefront layout. The wire shape is
// { id, type, variant, props, children? } (see the admin SDUI builder and
// PATCH /admin/tenants/{uuid}/ui-layout); MainServer stores it without validating, so the
// parser rebuilds every block into this strict shape.
export type LayoutBlock = {
  id: string;
  type: string;
  variant: string;
  props: Record<string, unknown>;
  children: LayoutBlock[];
};

// Loading: the tenant response has not arrived. Ready: it has (the layout may be empty).
// Unavailable: the first load failed, so nothing is known about the layout.
export type LayoutStatus = 'loading' | 'ready' | 'unavailable';

export const MAX_LAYOUT_BLOCKS = 30;
export const MAX_LAYOUT_DEPTH = 3;
