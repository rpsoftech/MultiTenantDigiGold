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
  return <CategoryCatalogue categoryId={categoryId} />;
}
