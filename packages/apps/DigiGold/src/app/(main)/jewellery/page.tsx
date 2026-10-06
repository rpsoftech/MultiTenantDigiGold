import { CategoryCatalogue } from '@/components/jewellery/CategoryCatalogue/CategoryCatalogue';
import { DEFAULT_JEWELLERY_CATEGORY_ID } from '@/features/marketplace/marketplace.catalogue';

// Renders the default category in place. A redirect() here only runs once JavaScript has
// loaded in a static export, which left a blank page until then.
export default function JewelleryPage() {
  return <CategoryCatalogue categoryId={DEFAULT_JEWELLERY_CATEGORY_ID} />;
}
