'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import { ArrowRightIcon, LockFilledIcon, EyeIcon, EyeOffIcon } from '@/components/common/icons/Icons';
import { useToast } from '@/components/common/Toast/Toast';
import { useAdminLogin } from '@/features/admin-auth/hooks/useAdminLogin';
import { EMAIL_PATTERN } from '@/lib/constants/regex';
import { ROUTES } from '@/lib/constants/routes';
import styles from './AdminLoginForm.module.scss';

const adminLoginSchema = z.object({
  email: z.string().regex(EMAIL_PATTERN, 'Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type AdminLoginFormValues = z.infer<typeof adminLoginSchema>;

export function AdminLoginForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const adminLogin = useAdminLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: AdminLoginFormValues) => {
    try {
      await adminLogin.mutateAsync(values);
      router.push(ROUTES.adminDashboard);
    } catch {
      showToast({
        variant: 'danger',
        title: 'Could not sign in',
        description: 'Please check your email and password and try again.',
      });
    }
  };

  return (
    <Card className={styles.card}>
      <span className={styles.iconBadge}>
        <LockFilledIcon width={24} height={24} />
      </span>

      <h1 className={styles.title}>Admin Login</h1>
      <p className={styles.subtitle}>Sign in with your admin email and password</p>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="admin@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          rightIcon={
            <button
              type="button"
              className={styles.visibilityToggle}
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOffIcon width={18} height={18} />
              ) : (
                <EyeIcon width={18} height={18} />
              )}
            </button>
          }
          {...register('password')}
        />

        <Button type="submit" fullWidth isLoading={adminLogin.isPending} disabled={!isValid}>
          Sign In <ArrowRightIcon width={16} height={16} />
        </Button>
      </form>
    </Card>
  );
}
