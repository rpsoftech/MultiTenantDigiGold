'use client';

import Link from 'next/link';
import { Loader } from '@/components/common/Loader/Loader';
import { useTrendingProducts } from '@/features/marketplace/hooks/useTrendingProducts';
import { useTrendingJewelryConfig } from './useTrendingJewelryConfig';
import { ProductCard } from './ProductCard';
import styles from './TrendingJewelry.module.scss';

export function TrendingJewelry() {
  const config = useTrendingJewelryConfig();
  const { data: products, isLoading } = useTrendingProducts();

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>{config.title}</h2>
          <p className={styles.subtitle}>{config.subtitle}</p>
        </div>
        <Link href={config.viewAllUrl} className={styles.viewAllLink}>
          {config.viewAllLabel}
        </Link>
      </div>

      {isLoading && (
        <div className={styles.loaderWrap}>
          <Loader label="Loading trending jewelry" />
        </div>
      )}

      {!isLoading && products && products.length > 0 && (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} config={config} />
          ))}
        </div>
      )}

      {!isLoading && products && products.length === 0 && (
        <p className={styles.emptyState}>No trending jewelry available right now.</p>
      )}
    </section>
  );
}
