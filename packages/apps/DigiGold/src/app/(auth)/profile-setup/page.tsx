'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileSetupForm } from '@/components/auth/ProfileSetupForm/ProfileSetupForm';
import { useSession } from '@/features/auth/hooks/useSession';
import { ROUTES } from '@/lib/constants/routes';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user } = useSession();

  useEffect(() => {
    if (!user) {
      router.replace(ROUTES.login);
    } else if (!user.isNewUser) {
      router.replace(ROUTES.home);
    }
  }, [user, router]);

  if (!user || !user.isNewUser) return null;

  return <ProfileSetupForm />;
}
