'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePromoCarouselConfig } from './usePromoCarouselConfig';
import { cn } from '@/lib/utils/cn';
import styles from './PromoCarousel.module.scss';

export function PromoCarousel() {
  const { slides, autoplayIntervalMs } = usePromoCarouselConfig();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timeoutId = setTimeout(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, autoplayIntervalMs);
    return () => clearTimeout(timeoutId);
  }, [activeIndex, slides.length, autoplayIntervalMs]);

  if (!slides.length) return null;

  return (
    <section className={styles.section}>
      <div className={styles.viewport}>
        <div
          className={styles.track}
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {slides.map((slide) =>
            slide.linkUrl ? (
              <Link
                key={slide.id}
                href={slide.linkUrl}
                className={styles.slide}
                aria-label={slide.imageAlt}
              >
                <Image
                  src={slide.imageUrl}
                  alt={slide.imageAlt}
                  fill
                  priority
                  quality={95}
                  className={styles.image}
                  sizes="(min-width: 1280px) 1280px, 100vw"
                />
              </Link>
            ) : (
              <div key={slide.id} className={styles.slide}>
                <Image
                  src={slide.imageUrl}
                  alt={slide.imageAlt}
                  fill
                  priority
                  quality={95}
                  className={styles.image}
                  sizes="(min-width: 1280px) 1280px, 100vw"
                />
              </div>
            )
          )}
        </div>

        {slides.length > 1 && (
          <div className={styles.dots} role="tablist" aria-label="Promo slides">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Show slide ${index + 1} of ${slides.length}`}
                className={cn(styles.dot, index === activeIndex && styles.dotActive)}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
