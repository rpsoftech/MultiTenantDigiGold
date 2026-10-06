'use client';

import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.scss';
import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'inverted' | 'outlined';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  variant = 'primary',
  isLoading,
  fullWidth,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(styles.button, styles[variant], fullWidth && styles.fullWidth, className)}
      disabled={isLoading || disabled}
      {...rest}
    >
      {isLoading ? <span className={styles.spinner} aria-hidden /> : children}
    </button>
  );
}
