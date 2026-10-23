'use client';

import { useEffect, useState } from 'react';

// Height of the area the user can actually see. On phones it shrinks when the on-screen
// keyboard opens, which `dvh` alone does not always reflect (iOS Safari). Returns null where
// the Visual Viewport API is missing, so callers fall back to plain CSS units.
export function useVisualViewportHeight(enabled = true): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (!enabled || !viewport) return;
    const update = () => setHeight(Math.round(viewport.height));
    update();
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, [enabled]);

  return enabled ? height : null;
}
