import CategoryPageClient from '../../../marketplace/category/[categoryId]/CategoryPageClient';

const CATEGORY_IDS = [
  'anklets',
  'bangles',
  'bracelet',
  'chain',
  'chain-pendant',
  'kada',
  'watch',
  'tanmaniya',
  'pendant-set',
  'necklace',
  'rings',
];

export function generateStaticParams() {
  return CATEGORY_IDS.map((categoryId) => ({ categoryId }));
}

export default function JewelleryCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  return <CategoryPageClient params={params} />;
}
