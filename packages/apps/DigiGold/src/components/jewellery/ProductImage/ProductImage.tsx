import Image from 'next/image';
import styles from './ProductImage.module.scss';

type ProductImageProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

// A product photo that fills its (relatively positioned) container. A product without a
// photo shows a neutral panel instead of borrowing another product's picture.
export function ProductImage({ src, alt, sizes, className, priority }: ProductImageProps) {
  if (!src) {
    return (
      <div className={styles.placeholder} role="img" aria-label={`${alt}: no photo yet`}>
        No photo yet
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} />;
}
