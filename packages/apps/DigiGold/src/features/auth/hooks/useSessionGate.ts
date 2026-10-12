import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './useSession';
import { useSessionResolved } from './useSessionResolved';
import { ROUTES } from '@/lib/constants/routes';

// For pages that are only meaningful to a signed-in customer. Waits for the stored session
// to be restored (useSessionResolved) so a logged-in user doesn't flash a signed-out state
// on refresh, then sends anyone still unauthenticated to login.
// Gates on `isAuthenticated`, not `user`: registrationStarted creates a user for someone
// halfway through sign-up, who has no access token yet.
export function useSessionGate() {
  const router = useRouter();
  const { user, isAuthenticated } = useSession();
  const resolved = useSessionResolved();

  useEffect(() => {
    if (resolved && !isAuthenticated) router.replace(ROUTES.login);
  }, [resolved, isAuthenticated, router]);

  return { user, isReady: resolved && isAuthenticated };
}
