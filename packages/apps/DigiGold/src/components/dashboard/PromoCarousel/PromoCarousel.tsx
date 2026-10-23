'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useModuleShown } from '@/features/tenant/hooks/useModuleShown';
import { usePromoCarouselConfig } from './usePromoCarouselConfig';
import type { PromoCarouselProps } from '@/features/layout/layout.sections';
import { cn } from '@/lib/utils/cn';
import styles from './PromoCarousel.module.scss';

// Slides and timing normally come from the frontend config; a published layout block can
// supply the tenant's own.
export function PromoCarousel({
  slides: slidesOverride,
  autoplayIntervalMs: intervalOverride,
}: PromoCarouselProps = {}) {
  const config = usePromoCarouselConfig();
  const moduleShown = useModuleShown();
  // Configured slides can belong to a module the tenant has off; published ones are the
  // tenant's own and carry no module.
  const slides =
    slidesOverride ??
    config.slides.filter((slide) => moduleShown(slide.module));
  const autoplayIntervalMs = intervalOverride ?? config.autoplayIntervalMs;
  const [requestedIndex, setActiveIndex] = useState(0);
  // A republished layout can have fewer slides than the one that was showing.
  const activeIndex = slides.length
    ? Math.min(requestedIndex, slides.length - 1)
    : 0;

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
            ),
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
                className={cn(
                  styles.dot,
                  index === activeIndex && styles.dotActive,
                )}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
