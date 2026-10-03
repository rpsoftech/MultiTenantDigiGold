import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './useSession';
import { ROUTES } from '@/lib/constants/routes';

// The session is restored from the stored token in an effect after the first render, so
// `user` is null on first paint even for a logged-in customer. Screens that choose what to
// render from session data wait on `isReady` first, otherwise the wrong state flashes.
// A visitor with no session once the check settles is sent to login.
export function useSessionGate() {
  const router = useRouter();
  const { user } = useSession();
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    setIsChecked(true);
  }, []);

  useEffect(() => {
    if (isChecked && !user) router.replace(ROUTES.login);
  }, [isChecked, user, router]);

  return { user, isReady: isChecked && Boolean(user) };
}
