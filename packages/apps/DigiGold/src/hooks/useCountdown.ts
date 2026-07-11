'use client';

import { useEffect, useRef, useState } from 'react';

type UseCountdownOptions = {
  onExpire?: () => void;
};

export function useCountdown(initialSeconds: number, { onExpire }: UseCountdownOptions = {}) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpireRef.current?.();
      return;
    }
    const timeoutId = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timeoutId);
  }, [secondsLeft]);

  const restart = (seconds: number = initialSeconds) => setSecondsLeft(seconds);

  return { secondsLeft, isExpired: secondsLeft <= 0, restart };
}
