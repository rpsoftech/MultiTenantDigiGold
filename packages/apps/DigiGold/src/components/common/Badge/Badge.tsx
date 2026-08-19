import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Badge.module.scss';
import { cn } from '@/lib/utils/cn';

export type BadgeVariant = 'neutral' | 'success' | 'danger' | 'brand';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  icon?: ReactNode;
};

export function Badge({
  variant = 'neutral',
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[variant], className)} {...rest}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </span>
  );
}
