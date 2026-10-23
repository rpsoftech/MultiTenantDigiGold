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
import type { TrendingJewelryProps } from '@/features/layout/layout.sections';
import { useTrendingJewelryConfig } from './useTrendingJewelryConfig';
import { ProductCard } from './ProductCard';
import styles from './TrendingJewelry.module.scss';

// Jewellery content: hidden (and not fetched) when the jewellery catalogue is off for this
// tenant or this build (NEXT_PUBLIC_ENABLE_JEWELLERY=false in production), and until this
// host's tenant config has arrived, so a tenant with it off never briefly sees it.
export function TrendingJewelry(props: TrendingJewelryProps = {}) {
  const tenantConfig = useTenantConfig();
  const tenantResolved = useTenantResolved();
  if (!tenantResolved || !(tenantConfig?.activeModules.ecommerce ?? true))
    return null;
  return <TrendingJewelrySection {...props} />;
}

// Copy normally comes from the frontend config and the products from the marketplace
// feature; a published layout block can supply the tenant's own, which skips that fetch.
function TrendingJewelrySection({
  products: productsOverride,
  title,
  subtitle,
  viewAllUrl,
  viewAllLabel,
}: TrendingJewelryProps) {
  const defaults = useTrendingJewelryConfig();
  const config = {
    ...defaults,
    title: title ?? defaults.title,
    subtitle: subtitle ?? defaults.subtitle,
    viewAllUrl: viewAllUrl ?? defaults.viewAllUrl,
    viewAllLabel: viewAllLabel ?? defaults.viewAllLabel,
  };
  const {
    data: fetchedProducts,
    isLoading,
    isError,
    isSuccess,
    error,
    isFetching,
    refetch,
  } = useTrendingProducts({ enabled: !productsOverride });
  const products = productsOverride ?? fetchedProducts;

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

      {/* Products a tenant published in its layout are its own, not the sample catalogue. */}
      {!productsOverride && isMarketplaceSample() && <SampleCatalogueNotice />}

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

      {isSuccess && products?.length === 0 && (
        <p className={styles.emptyState}>
          No trending jewellery available right now.
        </p>
      )}
    </section>
  );
}
