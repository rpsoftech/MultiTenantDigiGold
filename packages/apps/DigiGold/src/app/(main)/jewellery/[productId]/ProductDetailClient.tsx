'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { HeartIcon, LockFilledIcon, ShieldCheckIcon, ShoppingBagIcon, TruckIcon } from '@/components/common/icons/Icons';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import type { Product } from '@/features/marketplace/marketplace.types';
import styles from './ProductDetail.module.scss';

export default function ProductDetailClient({ product }: { product: Product }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [purity, setPurity] = useState(product.carat);
  const [color, setColor] = useState(product.color.toUpperCase());

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link href="/home">Home</Link><span>/</span><Link href="/jewellery">Jewellery</Link><span>/</span><strong>{product.title}</strong>
      </div>
      <div className={styles.layout}>
        <section className={styles.gallery} aria-label={`${product.title} images`}>
          <div className={styles.imageFrame}>
            <Image src={product.imageUrl} alt={product.imageAlt} fill priority sizes="(min-width: 1024px) 52vw, 100vw" />
            <span className={styles.certification}><ShieldCheckIcon width={14} height={14} /> BIS Hallmarked</span>
            <button type="button" className={`${styles.imageFavorite} ${isFavorite ? styles.imageFavoriteActive : ''}`} aria-label={isFavorite ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={isFavorite} onClick={() => setIsFavorite((current) => !current)}>
              <HeartIcon width={25} height={25} />
            </button>
          </div>
          <div className={styles.mediaStrip} aria-label="Product media">
            <button type="button" className={styles.mediaThumbnail} aria-label={`View ${product.title} image`}>
              <Image src={product.imageUrl} alt="" fill sizes="76px" />
            </button>
          </div>
        </section>

        <section className={styles.details}>
          <div className={styles.detailTopline}><span>Make to Order</span><small>REF. {product.code}</small></div>
          <h1>{product.title}</h1>

          <div className={styles.specs}>
            <div><span>Weight</span><strong>{product.weight.toFixed(2)} gm</strong></div>
            <div><span>Purity</span><strong>{product.carat}</strong></div>
            <div><span>Colour</span><strong>{product.color.toUpperCase()}</strong></div>
          </div>

          <div className={styles.priceBox}>
            <span>Total Price (Incl. All Taxes)</span>
            <strong>{formatCurrency(product.price, product.currency)}.00</strong>
            <em>*Final price may vary with actual product weight.</em>
          </div>

          <div className={styles.choices}>
            <fieldset><legend>Choose Purity</legend><div className={styles.choiceOptions}>{['22KT Gold', '18KT Gold', '9KT Gold'].map((option) => <button type="button" className={purity === option ? styles.choiceSelected : ''} key={option} onClick={() => setPurity(option as Product['carat'])}>{option}<span>{purity === option ? '✓' : '○'}</span></button>)}</div></fieldset>
            <fieldset><legend>Choose Colour</legend><div className={styles.colorOptions}>{['YELLOW', 'ROSE', 'WHITE'].map((option) => <button type="button" className={color === option ? styles.choiceSelected : ''} key={option} onClick={() => setColor(option)}><i className={`${styles.colorDot} ${styles[option.toLowerCase()]}`} />{option[0] + option.slice(1).toLowerCase()}</button>)}</div></fieldset>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.buyButton}>Buy Now <span>→</span></button>
            <button type="button" className={styles.favoriteButton} aria-label="Add to bag"><ShoppingBagIcon width={21} height={21} /></button>
          </div>

          <div className={styles.trust}><span><ShieldCheckIcon width={20} height={20} /> <small>BIS Hallmark</small></span><span><LockFilledIcon width={19} height={19} /> <small>Secure Payment</small></span><span><TruckIcon width={21} height={21} /> <small>Free Shipping</small></span></div>
        </section>
      </div>
    </main>
  );
}

