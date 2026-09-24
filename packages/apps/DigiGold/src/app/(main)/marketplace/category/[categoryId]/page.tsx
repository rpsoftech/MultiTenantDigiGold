import CategoryPageClient from './CategoryPageClient';

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

export default function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  return <CategoryPageClient params={params} />;
}