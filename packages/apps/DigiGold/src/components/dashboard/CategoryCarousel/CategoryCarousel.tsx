'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader } from '@/components/common/Loader/Loader';
import { cn } from '@/lib/utils/cn';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/common/icons/Icons';
import { useCategories } from '@/features/marketplace/hooks/useCategories';
import { useCategoryCarouselConfig } from './useCategoryCarouselConfig';
import { CategoryCard } from './CategoryCard';
import styles from './CategoryCarousel.module.scss';

const SCROLL_STEP = 240;
const AUTOPLAY_INTERVAL_MS = 3000;
const SCROLL_END_THRESHOLD = 4;

export function CategoryCarousel() {
  const config = useCategoryCarouselConfig();
  const { data: categories, isLoading } = useCategories();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollPrev(track.scrollLeft > SCROLL_END_THRESHOLD);
    setCanScrollNext(
      track.scrollLeft < track.scrollWidth - track.clientWidth - SCROLL_END_THRESHOLD
    );
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !categories?.length) return;

    updateScrollState();
    track.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      track.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [categories, updateScrollState]);

  useEffect(() => {
    if (!categories?.length || categories.length < 2 || isPaused) return;

    const intervalId = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;

      if (track.scrollLeft >= track.scrollWidth - track.clientWidth - SCROLL_END_THRESHOLD) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });
      }
    }, AUTOPLAY_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [categories, isPaused]);

  const scrollByAmount = (direction: 1 | -1) => {
    trackRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' });
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{config.title}</h2>

      {isLoading && (
        <div className={styles.loaderWrap}>
          <Loader label="Loading categories" />
        </div>
      )}

      {!isLoading && categories && categories.length > 0 && (
        <div
          className={styles.carousel}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <button
            type="button"
            className={cn(styles.navButton, !canScrollPrev && styles.navButtonHidden)}
            data-direction="prev"
            onClick={() => scrollByAmount(-1)}
            aria-label="Scroll categories left"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>

          <div className={styles.track} ref={trackRef}>
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>

          <button
            type="button"
            className={cn(styles.navButton, !canScrollNext && styles.navButtonHidden)}
            data-direction="next"
            onClick={() => scrollByAmount(1)}
            aria-label="Scroll categories right"
          >
            <ChevronRightIcon width={18} height={18} />
          </button>
        </div>
      )}

      {!isLoading && categories && categories.length === 0 && (
        <p className={styles.emptyState}>No categories available right now.</p>
      )}
    </section>
  );
}
