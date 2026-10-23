import { ProductImage } from '@/components/jewellery/ProductImage/ProductImage';
import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import type { Product } from '@/features/marketplace/marketplace.types';
import { jewelleryProductHref } from '@/features/marketplace/marketplace.catalogue';
import type { TrendingJewelryConfig } from './TrendingJewelry.types';
import styles from './TrendingJewelry.module.scss';

export function ProductCard({
  product,
  config,
}: {
  // `href` is set for a product the tenant published in its layout; catalogue products
  // link to their own detail page.
  product: Pick<Product, 'id' | 'title' | 'imageUrl' | 'imageAlt' | 'price' | 'currency' | 'isNew'> & {
    href?: string;
  };
  config: TrendingJewelryConfig;
}) {
  return (
    <Card className={styles.productCard}>
      <div className={styles.imageWrap}>
        <ProductImage
          src={product.imageUrl}
          alt={product.imageAlt}
          className={styles.image}
          sizes="(min-width: 768px) 33vw, 90vw"
        />
        {product.isNew && (
          <Badge variant="brand" className={styles.newBadge}>
            {config.newBadgeLabel}
          </Badge>
        )}
      </div>

      <span className={styles.productTitle}>{product.title}</span>
      <span className={styles.productPrice}>
        {formatCurrency(product.price, product.currency)}
      </span>

      <Link
        href={product.href ?? jewelleryProductHref(product.id)}
        className={styles.viewDetailsLink}
      >
        {config.viewDetailsLabel}
      </Link>
    </Card>
  );
}
