'use client';

import { type ReactNode } from 'react';
import styles from './Tooltip.module.scss';
import { cn } from '@/lib/utils/cn';

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span className={cn(styles.wrapper, className)} tabIndex={0}>
      {children}
      <span role="tooltip" className={styles.bubble}>
        {content}
      </span>
    </span>
  );
}
