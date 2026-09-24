import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import type { Product } from '@/features/marketplace/marketplace.types';
import type { TrendingJewelryConfig } from './TrendingJewelry.types';
import styles from './TrendingJewelry.module.scss';

export function ProductCard({
  product,
  config,
}: {
  product: Product;
  config: TrendingJewelryConfig;
}) {
  return (
    <Card className={styles.productCard}>
      <div className={styles.imageWrap}>
        <Image
          src={product.imageUrl}
          alt={product.imageAlt}
          fill
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

      <Link href={product.url} className={styles.viewDetailsLink}>
        {config.viewDetailsLabel}
      </Link>
    </Card>
  );
}
