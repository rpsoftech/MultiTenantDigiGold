'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import { UserIcon } from '@/components/common/icons/Icons';
import { useToast } from '@/components/common/Toast/Toast';
import { useCompleteProfile } from '@/features/auth/hooks/useCompleteProfile';
import { useSession } from '@/features/auth/hooks/useSession';
import { getRegistrationToken, clearRegistrationToken } from '@/lib/auth/tokenStorage';
import { ROUTES } from '@/lib/constants/routes';
import styles from './ProfileSetupForm.module.scss';

// MainServer requires `location` on /auth/register but phase 1 collects no location input
// (no address/geolocation step in the profile-setup screen yet).
// TODO: confirm with backend/product whether this needs real user input later.
const DEFAULT_REGISTRATION_LOCATION = 'India';

const profileSetupSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(50, 'Full name must be 50 characters or fewer'),
  // MainServer's /auth/register marks `location` as required (auth_controller.go).
  location: z.string().trim().min(2, 'Enter your city').max(100, 'City must be 100 characters or fewer'),
  emailId: z.string().email('Enter a valid email').optional().or(z.literal('')),
});

type ProfileSetupFormValues = z.infer<typeof profileSetupSchema>;

export function ProfileSetupForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const completeProfile = useCompleteProfile();
  const { user } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ProfileSetupFormValues>({
    resolver: zodResolver(profileSetupSchema),
    mode: 'onChange',
    defaultValues: { fullName: '', location: '', emailId: '' },
  });

  const onSubmit = async (values: ProfileSetupFormValues) => {
    try {
      if (!user?.isNewUser) return;
      const registrationToken = getRegistrationToken();
      if (!registrationToken) throw new Error('Registration session expired');
      await completeProfile.mutateAsync({
        ...values,
        registrationToken,
        location: DEFAULT_REGISTRATION_LOCATION,
      });
      clearRegistrationToken();
      router.push(ROUTES.home);
    } catch {
      showToast({ variant: 'danger', title: 'Could not create your account' });
    }
  };

  return (
    <Card className={styles.card}>
      <h1 className={styles.title}>Let&apos;s get to know you</h1>
      <p className={styles.subtitle}>Complete your basic profile to unlock your digital vault.</p>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Full Name"
          placeholder="Jane Doe"
          maxLength={50}
          rightIcon={<UserIcon width={16} height={16} />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label="City"
          placeholder="Mumbai"
          maxLength={100}
          autoComplete="address-level2"
          error={errors.location?.message}
          {...register('location')}
        />
        <Input
          label="Email (Optional)"
          placeholder="you@example.com"
          type="email"
          error={errors.emailId?.message}
          {...register('emailId')}
        />

        <Button type="submit" fullWidth isLoading={completeProfile.isPending} disabled={!isValid}>
          Create Account
        </Button>
      </form>
    </Card>
  );
}
