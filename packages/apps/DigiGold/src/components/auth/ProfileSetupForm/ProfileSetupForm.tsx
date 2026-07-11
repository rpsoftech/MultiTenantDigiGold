'use client';

import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import { DatePickerField } from '@/components/common/DatePickerField/DatePickerField';
import { MapPinIcon, UserIcon } from '@/components/common/icons/Icons';
import { useToast } from '@/components/common/Toast/Toast';
import { useCompleteProfile } from '@/features/auth/hooks/useCompleteProfile';
import { ROUTES } from '@/lib/constants/routes';
import styles from './ProfileSetupForm.module.scss';

const profileSetupSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name'),
  dateOfBirth: z.string().min(1, 'Enter your date of birth'),
  city: z.string().trim().min(2, 'Enter your city'),
});

type ProfileSetupFormValues = z.infer<typeof profileSetupSchema>;

export function ProfileSetupForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const completeProfile = useCompleteProfile();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ProfileSetupFormValues>({
    resolver: zodResolver(profileSetupSchema),
    mode: 'onChange',
    defaultValues: { fullName: '', dateOfBirth: '', city: '' },
  });

  const onSubmit = async (values: ProfileSetupFormValues) => {
    try {
      await completeProfile.mutateAsync(values);
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
          rightIcon={<UserIcon width={16} height={16} />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Controller
          name="dateOfBirth"
          control={control}
          render={({ field }) => (
            <DatePickerField
              name={field.name}
              label="Date of Birth (DD/MM/YYYY)"
              error={errors.dateOfBirth?.message}
              value={field.value ? new Date(field.value) : undefined}
              maxDate={new Date()}
              onChange={(date) => field.onChange(date.toISOString())}
            />
          )}
        />
        <Input
          label="City"
          placeholder="e.g. New York"
          rightIcon={<MapPinIcon width={16} height={16} />}
          error={errors.city?.message}
          {...register('city')}
        />

        <Button type="submit" fullWidth isLoading={completeProfile.isPending} disabled={!isValid}>
          Create Account
        </Button>
      </form>

      <div className={styles.dots} aria-hidden>
        <span className={styles.dotActive} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </Card>
  );
}
