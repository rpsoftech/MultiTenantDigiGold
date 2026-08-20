'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import { Badge } from '@/components/common/Badge/Badge';
import { Logo } from '@/components/common/Logo/Logo';
import {
  ArrowRightIcon,
  ShieldIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  LockFilledIcon,
} from '@/components/common/icons/Icons';
import { useToast } from '@/components/common/Toast/Toast';
import { useRequestOtp } from '@/features/auth/hooks/useRequestOtp';
import { MOBILE_NUMBER_PATTERN } from '@/lib/constants/regex';
import { OtpForm } from '@/components/auth/OtpForm/OtpForm';
import styles from './LoginForm.module.scss';

const loginSchema = z.object({
  mobileNumber: z
    .string()
    .regex(MOBILE_NUMBER_PATTERN, 'Enter a valid 10-digit mobile number'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export type LoginFormProps = {
  successRoute?: string;
};

export function LoginForm({ successRoute }: LoginFormProps) {
  const { showToast } = useToast();
  const requestOtp = useRequestOtp();
  const [otpMobileNumber, setOtpMobileNumber] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { mobileNumber: '' },
  });

  const onSubmit = async ({ mobileNumber }: LoginFormValues) => {
    try {
      await requestOtp.mutateAsync({ mobileNumber });
      setOtpMobileNumber(mobileNumber);
    } catch {
      showToast({
        variant: 'danger',
        title: 'Could not send OTP',
        description: 'Please check the number and try again.',
      });
    }
  };

  if (otpMobileNumber) {
    return (
      <OtpForm
        mobileNumber={otpMobileNumber}
        successRoute={successRoute}
        onEditNumber={() => setOtpMobileNumber(null)}
      />
    );
  }

  const { onChange: onMobileNumberChange, ...mobileNumberField } = register('mobileNumber');

  return (
    <Card className={styles.card}>
      {/* Mobile: brand wordmark in-card (no page header on the login screen). */}
      <Logo className={styles.mobileBrand} height={32} />

      {/* Desktop: icon badge (the page header already carries the brand). */}
      <span className={styles.iconBadge}>
        <LockFilledIcon width={24} height={24} />
      </span>

      <h1 className={styles.title}>Welcome</h1>
      <p className={styles.subtitle}>
        Login or Register to access your digital vault
      </p>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Mobile Number"
          leftAddon={
            <>
              +91 <ChevronDownIcon width={14} height={14} />
            </>
          }
          placeholder="00000 00000"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          error={errors.mobileNumber?.message}
          onChange={(event) => {
            event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
            onMobileNumberChange(event);
          }}
          {...mobileNumberField}
        />

        <Button
          type="submit"
          fullWidth
          isLoading={requestOtp.isPending}
          disabled={!isValid}
        >
          Get OTP <ArrowRightIcon width={16} height={16} />
        </Button>
      </form>

      <p className={styles.termsNotice}>
        By continuing, you agree to our{' '}
        <Link href="#" className={styles.termsLink}>
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="#" className={styles.termsLink}>
          Privacy Policy
        </Link>
        .
      </p>

      <div className={styles.trustRow}>
        <Badge icon={<ShieldIcon width={14} height={14} />}>Secure</Badge>
        <Badge icon={<ShieldCheckIcon width={14} height={14} />}>Insured</Badge>
      </div>
    </Card>
  );
}
