'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import styles from './PickupCodeCard.module.scss';

type PickupCodeCardProps = {
  code: string;
  compact?: boolean;
};

const COPIED_RESET_MS = 2000;

export function PickupCodeCard({ code, compact }: PickupCodeCardProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copied = copyState === 'copied';

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      // Clipboard unavailable (insecure context, or denied on a phone): the code is still on
      // screen and selects in one tap, so say that instead of failing silently.
      setCopyState('failed');
    }
  };

  return (
    <div className={cn(styles.card, compact && styles.compact)}>
      <span className={styles.label}>Pickup code</span>
      <span
        className={styles.code}
        aria-label={`Pickup code ${code.split('').join(' ')}`}
      >
        {code}
      </span>
      {!compact && (
        <p className={styles.hint}>
          Show this code at the store counter to collect your gold. Keep it
          private, anyone with the code can collect it.
        </p>
      )}
      <button
        type="button"
        className={cn(styles.copyButton, copied && styles.copied)}
        onClick={() => void handleCopy()}
        aria-live="polite"
      >
        {copied ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy code'}
      </button>
      {copyState === 'failed' && (
        <span className={styles.copyHint} role="status">
          Tap the code to select it, then copy.
        </span>
      )}
    </div>
  );
}
