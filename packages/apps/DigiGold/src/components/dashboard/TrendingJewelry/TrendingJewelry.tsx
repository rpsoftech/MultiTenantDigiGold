'use client';

import Link from 'next/link';
import { Loader } from '@/components/common/Loader/Loader';
import { Button } from '@/components/common/Button/Button';
import { describeApiError } from '@/lib/api/client';
import { useTrendingProducts } from '@/features/marketplace/hooks/useTrendingProducts';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useTenantResolved } from '@/features/tenant/hooks/useTenantResolved';
import { isMarketplaceSample } from '@/features/marketplace/marketplace.sample';
import { SampleCatalogueNotice } from '@/components/jewellery/SampleCatalogueNotice/SampleCatalogueNotice';
import { useTrendingJewelryConfig } from './useTrendingJewelryConfig';
import { ProductCard } from './ProductCard';
import styles from './TrendingJewelry.module.scss';

// Jewellery content: hidden (and not fetched) when the jewellery catalogue is off for this
// tenant or this build (NEXT_PUBLIC_ENABLE_JEWELLERY=false in production), and until this
// host's tenant config has arrived, so a tenant with it off never briefly sees it.
export function TrendingJewelry() {
  const tenantConfig = useTenantConfig();
  const tenantResolved = useTenantResolved();
  if (!tenantResolved || !(tenantConfig?.activeModules.ecommerce ?? true))
    return null;
  return <TrendingJewelrySection />;
}

function TrendingJewelrySection() {
  const config = useTrendingJewelryConfig();
  const {
    data: products,
    isLoading,
    isError,
    isSuccess,
    error,
    isFetching,
    refetch,
  } = useTrendingProducts();

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

      {isMarketplaceSample() && <SampleCatalogueNotice />}

      {isLoading && (
        <div className={styles.loaderWrap}>
          <Loader label="Loading trending jewellery" />
        </div>
      )}

      {isError && (
        <div className={styles.errorState} role="alert">
          <p>We couldn't load trending jewellery.</p>
          <p>{describeApiError(error) ?? 'Please try again.'}</p>
          <Button
            variant="outlined"
            onClick={() => void refetch()}
            isLoading={isFetching}
            aria-label="Retry loading trending jewellery"
          >
            Try again
          </Button>
        </div>
      )}

      {!isLoading && products && products.length > 0 && (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} config={config} />
          ))}
        </div>
      )}

      {isSuccess && products.length === 0 && (
        <p className={styles.emptyState}>
          No trending jewellery available right now.
        </p>
      )}
    </section>
  );
}
