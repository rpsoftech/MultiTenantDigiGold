'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Input.module.scss';
import { cn } from '@/lib/utils/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelSuffix?: ReactNode;
  error?: string;
  leftAddon?: ReactNode;
  rightIcon?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, labelSuffix, error, leftAddon, rightIcon, className, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;
  const errorId = useId();

  return (
    <div className={styles.field}>
      {label && (
        <span className={styles.labelRow}>
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
          {labelSuffix}
        </span>
      )}
      <div className={cn(styles.inputWrapper, error && styles.inputWrapperError)}>
        {leftAddon && <span className={styles.addon}>{leftAddon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(styles.input, className)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : rest['aria-describedby']}
          {...rest}
        />
        {rightIcon && <span className={styles.icon}>{rightIcon}</span>}
      </div>
      {error && (
        <span id={errorId} className={styles.errorText} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
