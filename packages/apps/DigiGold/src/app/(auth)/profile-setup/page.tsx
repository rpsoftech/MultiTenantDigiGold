'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileSetupForm } from '@/components/auth/ProfileSetupForm/ProfileSetupForm';
import { useSession } from '@/features/auth/hooks/useSession';
import { useSessionResolved } from '@/features/auth/hooks/useSessionResolved';
import { ROUTES } from '@/lib/constants/routes';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user } = useSession();
  // This page's effect runs before SessionLifecycle's (children first), so on a page refresh
  // the registration isn't restored yet: wait, or a customer halfway through sign-up is sent
  // back to login.
  const resolved = useSessionResolved();

  useEffect(() => {
    if (!resolved) return;
    if (!user) {
      router.replace(ROUTES.login);
    } else if (!user.isNewUser) {
      router.replace(ROUTES.home);
    }
  }, [resolved, user, router]);

  if (!resolved || !user || !user.isNewUser) return null;

  return <ProfileSetupForm />;
}
