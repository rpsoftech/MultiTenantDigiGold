'use client';

import { useEffect } from 'react';
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
import { useSessionResolved } from '@/features/auth/hooks/useSessionResolved';
import { useKycStatus } from '@/features/kyc/hooks/useKycStatus';
import { useSubmitKyc } from '@/features/kyc/hooks/useSubmitKyc';
import { KYC_REQUIRED_ABOVE_INR } from '@/features/kyc/kyc.constants';
import { kycSchema, type KycFormValues } from '@/features/kyc/kyc.schema';
import { describeApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { ROUTES } from '@/lib/constants/routes';
import styles from './Kyc.module.scss';

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.statusPage}>
      <Card className={cn(styles.card, styles.statusCard)}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{body}</p>
        <Link href={ROUTES.home} className={styles.link}>
          Back to home
        </Link>
      </Card>
    </div>
  );
}

export function Kyc() {
  const router = useRouter();
  // `isAuthenticated`, not `user`: registrationStarted creates a user for someone halfway
  // through sign-up, who has no access token and would only get a 401 on submit.
  const { isAuthenticated } = useSession();
  // isAuthenticated is false until SessionLifecycle restores a stored session after mount,
  // so wait for that before deciding the visitor is signed out.
  const sessionResolved = useSessionResolved();
  const { status, isError, isFetching, refetch } = useKycStatus();

  useEffect(() => {
    if (sessionResolved && !isAuthenticated) router.replace(ROUTES.login);
  }, [sessionResolved, isAuthenticated, router]);

  if (isAuthenticated && isError && !status) {
    return (
      <div className={styles.statusPage}>
        <Card className={cn(styles.card, styles.statusCard)}>
          <h1 className={styles.title}>Couldn&apos;t load your KYC status</h1>
          <p className={styles.subtitle}>Please check your connection and try again.</p>
          <Button variant="outlined" onClick={refetch} isLoading={isFetching}>
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !status) {
    return (
      <div className={styles.statusPage}>
        <Loader label="Loading your KYC status" />
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <StatusCard
        title="KYC verified"
        body={`Your identity is verified. Purchases above ${formatCurrency(KYC_REQUIRED_ABOVE_INR, 'INR')} are unlocked.`}
      />
    );
  }

  if (status === 'pending') {
    return (
      <StatusCard
        title="KYC under review"
        body="We've received your details. Verification is usually completed shortly, and higher purchase limits unlock once it is approved."
      />
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
    defaultValues: { panNumber: '', aadhaarLast4: '' },
  });

  const onSubmit = async (values: KycFormValues) => {
    try {
      await submitKyc.mutateAsync({
        pan_number: values.panNumber.toUpperCase(),
        aadhaar_last4: values.aadhaarLast4,
      });
      showToast({ variant: 'success', title: 'KYC submitted for verification' });
    } catch (error) {
      showToast({
        variant: 'danger',
        title: 'Could not submit KYC',
        description: describeApiError(error) ?? 'Please try again in a moment.',
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
          Required for purchases above {formatCurrency(KYC_REQUIRED_ABOVE_INR, 'INR')}. We only
          ask for the last 4 digits of your Aadhaar.
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

          <Button type="submit" fullWidth disabled={!isValid}>
            Submit for Verification
          </Button>
        </form>
      </div>
    </Card>
  );
}
