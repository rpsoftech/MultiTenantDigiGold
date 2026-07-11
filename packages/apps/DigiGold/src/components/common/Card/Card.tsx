import type { HTMLAttributes } from 'react';
import styles from './Card.module.scss';
import { cn } from '@/lib/utils/cn';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn(styles.card, className)} {...rest}>
      {children}
    </div>
  );
}
