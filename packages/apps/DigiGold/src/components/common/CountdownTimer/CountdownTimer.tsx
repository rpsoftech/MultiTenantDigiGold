'use client';

import { useCountdown } from '@/hooks/useCountdown';
import styles from './CountdownTimer.module.scss';
import { cn } from '@/lib/utils/cn';

export type CountdownTimerProps = {
  seconds: number;
  onExpire?: () => void;
  className?: string;
};

function formatMmSs(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CountdownTimer({ seconds, onExpire, className }: CountdownTimerProps) {
  const { secondsLeft } = useCountdown(seconds, { onExpire });

  return (
    <span className={cn(styles.timer, className)} aria-live="polite">
      {formatMmSs(secondsLeft)}
    </span>
  );
}
