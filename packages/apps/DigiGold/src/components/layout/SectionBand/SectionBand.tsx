import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import styles from './SectionBand.module.scss';

// Home sections sit on full-width bands that alternate gray and white, so neighbouring
// sections are always visually separated whichever blocks a tenant publishes and in
// whatever order. The first band is gray, under the white header.
export function bandTone(index: number): 'gray' | 'white' {
  return index % 2 === 0 ? 'gray' : 'white';
}

export function SectionBand({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className={cn(styles.band, bandTone(index) === 'white' && styles.white)}>{children}</div>
  );
}
