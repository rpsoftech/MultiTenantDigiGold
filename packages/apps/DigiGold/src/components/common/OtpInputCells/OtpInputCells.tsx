'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import styles from './OtpInputCells.module.scss';
import { cn } from '@/lib/utils/cn';

export type OtpInputCellsProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
};

const DIGIT_PATTERN = /^\d$/;

export function OtpInputCells({ length = 6, value, onChange, error }: OtpInputCellsProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  const setDigitAt = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(''));
  };

  const handleChange = (index: number, rawInput: string) => {
    const digit = rawInput.slice(-1);
    if (digit && !DIGIT_PATTERN.test(digit)) return;

    setDigitAt(index, digit);
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted.padEnd(length, '').slice(0, length));
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className={styles.cells} role="group" aria-label="One-time password">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputRefs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className={cn(styles.cell, error && styles.cellError)}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
