'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useToast } from '@/components/common/Toast/Toast';
import { useAdminProfile } from '@/features/admin-auth/hooks/useAdminProfile';
import { useUpdateAdminProfile } from '@/features/admin-auth/hooks/useUpdateAdminProfile';
import { EMAIL_PATTERN, MOBILE_NUMBER_PATTERN } from '@/lib/constants/regex';
import styles from './AdminProfileView.module.scss';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().regex(EMAIL_PATTERN, 'Enter a valid email address'),
  phone: z
    .string()
    .optional()
    .refine((value) => !value || MOBILE_NUMBER_PATTERN.test(value), {
      message: 'Enter a valid 10-digit mobile number',
    }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function AdminProfileView() {
  const { data: profile, isLoading } = useAdminProfile();
  const updateProfile = useUpdateAdminProfile();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { name: '', email: '', phone: '' },
  });

  useEffect(() => {
    if (profile) {
      reset({ name: profile.name, email: profile.email, phone: profile.phone ?? '' });
    }
  }, [profile, reset]);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await updateProfile.mutateAsync(values);
      showToast({ variant: 'success', title: 'Profile updated' });
    } catch {
      showToast({
        variant: 'danger',
        title: 'Could not update profile',
        description: 'Please try again.',
      });
    }
  };

  if (isLoading || !profile) {
    return <Loader />;
  }

  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <h1 className={styles.title}>Admin Profile</h1>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
          <Input label="Full Name" error={errors.name?.message} {...register('name')} />
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            error={errors.phone?.message}
            {...register('phone')}
          />

          <div className={styles.actions}>
            <Button
              type="submit"
              className={styles.saveButton}
              isLoading={updateProfile.isPending}
              disabled={!isValid || !isDirty}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
