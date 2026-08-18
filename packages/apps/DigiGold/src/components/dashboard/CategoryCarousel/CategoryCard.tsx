import Image from 'next/image';
import Link from 'next/link';
import type { Category } from '@/features/marketplace/marketplace.types';
import styles from './CategoryCarousel.module.scss';

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link href={category.url} className={styles.card}>
      <div className={styles.imageWrap}>
        <Image
          src={category.imageUrl}
          alt={category.imageAlt}
          fill
          className={styles.image}
          sizes="(min-width: 1024px) 160px, 30vw"
        />
      </div>
      <span className={styles.label}>{category.label}</span>
    </Link>
  );
}
