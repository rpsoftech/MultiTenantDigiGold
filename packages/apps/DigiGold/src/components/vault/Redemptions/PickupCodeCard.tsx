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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard unavailable (insecure context or denied): the code is still on screen.
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
        {copied ? 'Copied' : 'Copy code'}
      </button>
    </div>
  );
}
