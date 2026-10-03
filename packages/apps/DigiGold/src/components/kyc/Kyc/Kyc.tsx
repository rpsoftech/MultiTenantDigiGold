'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Loader } from '@/components/common/Loader/Loader';
import { Button } from '@/components/common/Button/Button';
import { useToast } from '@/components/common/Toast/Toast';
import { useSession } from '@/features/auth/hooks/useSession';
import { useSubmitKyc } from '@/features/kyc/hooks/useSubmitKyc';
import { kycSchema, type KycFormValues } from '@/features/kyc/kyc.schema';
import type { NormalizedApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';
import styles from './Kyc.module.scss';

export function Kyc() {
  const router = useRouter();
  const { user } = useSession();
  // The session is restored from the stored token in an effect after the first render, so
  // `user` is null on first paint even for a logged-in customer. Wait for that to settle
  // before choosing between the form and the status cards, otherwise the form flashes.
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const status = user?.kycStatus ?? 'not_started';

  useEffect(() => {
    setIsSessionChecked(true);
  }, []);

  useEffect(() => {
    if (isSessionChecked && !user) router.replace(ROUTES.login);
  }, [isSessionChecked, user, router]);

  if (!isSessionChecked || !user) {
    return (
      <div className={styles.statusPage}>
        <Loader label="Loading your KYC status" />
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className={styles.statusPage}>
        <Card className={cn(styles.card, styles.statusCard)}>
          <h1 className={styles.title}>KYC verified</h1>
          <p className={styles.subtitle}>
            Your identity is verified. You can buy gold without purchase limits.
          </p>
          <Link href={ROUTES.home} className={styles.link}>
            Back to home
          </Link>
        </Card>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className={styles.statusPage}>
        <Card className={cn(styles.card, styles.statusCard)}>
          <h1 className={styles.title}>KYC under review</h1>
          <p className={styles.subtitle}>
            We&apos;ve received your details. Verification is usually completed
            shortly. We&apos;ll unlock higher purchase limits once it is
            approved.
          </p>
          <Link href={ROUTES.home} className={styles.link}>
            Back to home
          </Link>
        </Card>
      </div>
    );
  }

  return <KycForm rejected={status === 'rejected'} />;
}

function KycForm({ rejected }: { rejected: boolean }) {
  const { showToast } = useToast();
  const submitKyc = useSubmitKyc();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    mode: 'onChange',
    defaultValues: { panNumber: '', aadhaarLast4: '', documentUrl: '' },
  });

  const onSubmit = async (values: KycFormValues) => {
    try {
      await submitKyc.mutateAsync({
        pan_number: values.panNumber.toUpperCase(),
        aadhaar_last4: values.aadhaarLast4,
        ...(values.documentUrl ? { document_url: values.documentUrl } : {}),
      });
      showToast({
        variant: 'success',
        title: 'KYC submitted for verification',
      });
    } catch (error) {
      const normalized = error as NormalizedApiError;
      showToast({
        variant: 'danger',
        title: 'Could not submit KYC',
        description: normalized.message ?? 'Please try again in a moment.',
      });
    }
  };

  return (
    <Card className={styles.card}>
      {submitKyc.isPending && (
        <div className={styles.loaderRow}>
          <Loader label="Submitting your KYC" />
        </div>
      )}

      {/* Stays mounted (just hidden) while submitting so entered values survive a failed request. */}
      <div className={styles.formContent} hidden={submitKyc.isPending}>
        <h1 className={styles.title}>Complete your KYC</h1>
        <p className={styles.subtitle}>
          Required for purchases above ₹50,000. We only ask for the last 4
          digits of your Aadhaar.
        </p>

        {rejected && (
          <p className={styles.notice} data-variant="danger">
            Your previous KYC submission was not approved. Please check your
            details and submit again.
          </p>
        )}

        <form
          className={styles.form}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Input
            label="PAN Number"
            placeholder="ABCDE1234F"
            maxLength={10}
            autoCapitalize="characters"
            autoComplete="off"
            error={errors.panNumber?.message}
            {...register('panNumber', {
              setValueAs: (value: string) => value.toUpperCase(),
            })}
          />
          <Input
            label="Aadhaar (last 4 digits)"
            placeholder="1234"
            maxLength={4}
            inputMode="numeric"
            autoComplete="off"
            error={errors.aadhaarLast4?.message}
            {...register('aadhaarLast4')}
          />
          <Input
            label="Document Link (Optional)"
            placeholder="https://..."
            type="url"
            inputMode="url"
            autoComplete="off"
            error={errors.documentUrl?.message}
            {...register('documentUrl')}
          />

          <Button type="submit" fullWidth disabled={!isValid}>
            Submit for Verification
          </Button>
        </form>
      </div>
    </Card>
  );
}
