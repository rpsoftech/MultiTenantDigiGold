import { Suspense } from 'react';
import { CategoryCatalogue } from '@/components/jewellery/CategoryCatalogue/CategoryCatalogue';
import { DEFAULT_JEWELLERY_CATEGORY_ID } from '@/features/marketplace/marketplace.catalogue';

// Shows the default category directly. A redirect() here would only run in the browser
// (static export), leaving a blank page until JavaScript loads.
export default function JewelleryPage() {
  return (
    <Suspense fallback={null}>
      <CategoryCatalogue categoryId={DEFAULT_JEWELLERY_CATEGORY_ID} />
    </Suspense>
  );
}
