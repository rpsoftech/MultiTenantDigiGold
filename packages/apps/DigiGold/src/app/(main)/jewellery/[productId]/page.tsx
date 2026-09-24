import { notFound } from 'next/navigation';
import { marketplaceService } from '@/features/marketplace/marketplace.service';
import ProductDetailClient from './ProductDetailClient';

export function generateStaticParams() {
  return marketplaceService.getMockProducts().map((product) => ({ productId: product.id }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await marketplaceService.getProduct(productId);

  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
