import { Suspense } from 'react';
import { CategoryCatalogue } from '@/components/jewellery/CategoryCatalogue/CategoryCatalogue';
import { JEWELLERY_CATEGORIES } from '@/features/marketplace/marketplace.catalogue';

export function generateStaticParams() {
  return JEWELLERY_CATEGORIES.map(({ id }) => ({ categoryId: id }));
}

export default async function JewelleryCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  // CategoryCatalogue reads its filters from the query string (useSearchParams), which a
  // static export can only provide on the client.
  return (
    <Suspense fallback={null}>
      <CategoryCatalogue categoryId={categoryId} />
    </Suspense>
  );
}
