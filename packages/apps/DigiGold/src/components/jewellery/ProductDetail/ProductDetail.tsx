'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/common/Button/Button';
import { ShieldCheckIcon } from '@/components/common/icons/Icons';
import { Loader } from '@/components/common/Loader/Loader';
import { JewelleryUnavailable } from '@/components/jewellery/JewelleryUnavailable/JewelleryUnavailable';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import {
  jewelleryCategoryHref,
  jewelleryCategoryLabel,
} from '@/features/marketplace/marketplace.catalogue';
import { marketplaceService } from '@/features/marketplace/marketplace.service';
import type { Product } from '@/features/marketplace/marketplace.types';
import { describeApiError } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants/routes';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import styles from './ProductDetail.module.scss';

// Product.category is the display label ("Chain Pendant"); category routes use the id.
function categoryIdFromLabel(label: string): string | null {
  const id = label.trim().toLowerCase().replace(/\s+/g, '-');
  return jewelleryCategoryLabel(id) ? id : null;
}

function StatePanel({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.state}>{children}</div>
    </main>
  );
}

export function ProductDetail() {
  const tenantConfig = useTenantConfig();
  const productId = useSearchParams().get('id') ?? '';
  const ecommerceEnabled = tenantConfig?.activeModules.ecommerce ?? true;

  const {
    data: product,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['marketplace', 'product', productId],
    queryFn: () => marketplaceService.getProduct(productId),
    enabled: ecommerceEnabled && productId !== '',
  });

  if (!ecommerceEnabled) return <JewelleryUnavailable />;

  if (isLoading) {
    return (
      <StatePanel>
        <Loader label="Loading design" />
      </StatePanel>
    );
  }

  if (isError) {
    return (
      <StatePanel>
        <strong>We couldn&apos;t load this design.</strong>
        <span>{describeApiError(error) ?? 'Please try again.'}</span>
        <Button
          variant="outlined"
          onClick={() => void refetch()}
          isLoading={isFetching}
        >
          Try again
        </Button>
      </StatePanel>
    );
  }

  if (!product) {
    return (
      <StatePanel>
        <strong>This design isn&apos;t available.</strong>
        <Link href={ROUTES.jewellery}>Browse jewellery</Link>
      </StatePanel>
    );
  }

  return <ProductView product={product} />;
}

function ProductView({ product }: { product: Product }) {
  const categoryId = categoryIdFromLabel(product.category);

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href={ROUTES.home}>Home</Link>
        <span>/</span>
        <Link href={ROUTES.jewellery}>Jewellery</Link>
        {categoryId && (
          <>
            <span>/</span>
            <Link href={jewelleryCategoryHref(categoryId)}>
              {product.category}
            </Link>
          </>
        )}
        <span>/</span>
        <strong>{product.title}</strong>
      </nav>

      <div className={styles.layout}>
        <section
          className={styles.gallery}
          aria-label={`${product.title} image`}
        >
          <div className={styles.imageFrame}>
            <Image
              src={product.imageUrl}
              alt={product.imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
            />
            {/* A certification claim, so only when the catalogue data asserts it. */}
            {product.isBisHallmarked && (
              <span className={styles.certification}>
                <ShieldCheckIcon width={14} height={14} /> BIS Hallmarked
              </span>
            )}
          </div>
        </section>

        <section className={styles.details}>
          <div className={styles.detailTopline}>
            <small>REF. {product.code}</small>
          </div>
          <h1>{product.title}</h1>

          <div className={styles.specs}>
            <div>
              <span>Weight</span>
              <strong>{product.weight.toFixed(2)} gm</strong>
            </div>
            <div>
              <span>Purity</span>
              <strong>{product.carat}</strong>
            </div>
            <div>
              <span>Colour</span>
              <strong>{product.color}</strong>
            </div>
          </div>

          <div className={styles.priceBox}>
            <span>Indicative price</span>
            <strong>
              {formatCurrency(product.price, product.currency, 2)}
            </strong>
            <em>
              *Final price depends on the actual weight and the gold rate on the
              day.
            </em>
          </div>

          {/* Buying, purity/colour choices and wishlists aren't implemented yet; showing
              controls that do nothing read as if an order had been placed. */}
          <p className={styles.notice}>
            Online ordering for jewellery isn&apos;t available yet. Visit the
            store to buy this design.
          </p>
        </section>
      </div>
    </main>
  );
}
