import styles from './Loader.module.scss';
import { cn } from '@/lib/utils/cn';

export type LoaderProps = {
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
};

export function Loader({ size = 'md', label = 'Loading', className }: LoaderProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(styles.loader, styles[size], className)}
    />
  );
}

export type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  className?: string;
};

export function Skeleton({ width = '100%', height = '1rem', rounded, className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(styles.skeleton, rounded && styles.skeletonRounded, className)}
      style={{ width, height }}
    />
  );
}
