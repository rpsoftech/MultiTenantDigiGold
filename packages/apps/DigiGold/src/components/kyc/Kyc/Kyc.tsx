'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Loader } from '@/components/common/Loader/Loader';
import { Button } from '@/components/common/Button/Button';
import { useToast } from '@/components/common/Toast/Toast';
import {
  ArrowRightIcon,
  ClockIcon,
  CloseIcon,
  InfoIcon,
  LockIcon,
  ShieldCheckIcon,
  ShieldIcon,
} from '@/components/common/icons/Icons';
import { useSessionGate } from '@/features/auth/hooks/useSessionGate';
import { useKycStatus } from '@/features/kyc/hooks/useKycStatus';
import { useSubmitKyc } from '@/features/kyc/hooks/useSubmitKyc';
import { KYC_REQUIRED_ABOVE_INR } from '@/features/kyc/kyc.constants';
import { kycSchema, type KycFormValues } from '@/features/kyc/kyc.schema';
import { describeApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { ROUTES } from '@/lib/constants/routes';
import styles from './Kyc.module.scss';

type Tone = 'success' | 'pending' | 'danger' | 'neutral';

type KycPanelProps = {
  tone: Tone;
  icon: ReactNode;
  badge: string;
  title: string;
  body: string;
  // Extra content under the summary on the left, e.g. a rejection notice.
  aside?: ReactNode;
  // The right-hand side: progress, benefits or the form.
  children?: ReactNode;
};

// Shared two-column frame for every KYC state. The left side summarises the status (icon, pill,
// headline, copy); the right side holds the details or the form. They stack on small screens.
function KycSplit({ tone, icon, badge, title, body, aside, children }: KycPanelProps) {
  return (
    <div className={styles.page}>
      <Card className={styles.split} data-tone={tone}>
        <section className={styles.aside}>
          <span className={styles.accent} aria-hidden />
          <span className={styles.medallion} aria-hidden>
            {icon}
          </span>
          <span className={styles.badge}>{badge}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{body}</p>
          {aside}
        </section>
        <section className={styles.main}>{children}</section>
      </Card>
    </div>
  );
}

type Step = { label: string; hint: string; state: 'done' | 'current' | 'upcoming' };

function ReviewSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className={styles.steps} aria-label="Verification progress">
      {steps.map((step, index) => (
        <li key={step.label} className={styles.step} data-state={step.state}>
          <span className={styles.stepMarker} aria-hidden>
            {step.state === 'done' ? '✓' : index + 1}
          </span>
          <span className={styles.stepText}>
            <span className={styles.stepLabel}>{step.label}</span>
            <span className={styles.stepHint}>{step.hint}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const PENDING_STEPS: Step[] = [
  { label: 'Details submitted', hint: 'We have your PAN and Aadhaar digits', state: 'done' },
  { label: 'Under review', hint: 'Usually completed shortly', state: 'current' },
  { label: 'Approved', hint: 'Higher purchase limits unlock', state: 'upcoming' },
];

export function Kyc() {
  // Waits for session restore, then redirects anyone without an access token (including a
  // half-registered visitor) to login.
  const { isReady } = useSessionGate();
  const { status, isError, isFetching, refetch } = useKycStatus();

  if (isReady && isError && !status) {
    return (
      <KycSplit
        tone="danger"
        icon={<InfoIcon width={32} height={32} />}
        badge="Connection problem"
        title="Couldn't load your KYC status"
        body="Please check your connection and try again."
      >
        <div className={styles.actions}>
          <Button variant="outlined" onClick={refetch} isLoading={isFetching}>
            Try again
          </Button>
        </div>
      </KycSplit>
    );
  }

  if (!isReady || !status) {
    return (
      <div className={styles.page}>
        <div className={styles.loaderRow}>
          <Loader label="Loading your KYC status" />
        </div>
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <KycSplit
        tone="success"
        icon={<ShieldCheckIcon width={32} height={32} />}
        badge="Verified"
        title="KYC verified"
        body={`Your identity is verified. Purchases above ${formatCurrency(KYC_REQUIRED_ABOVE_INR, 'INR')} are unlocked.`}
      >
        <h2 className={styles.mainTitle}>What this means for you</h2>
        <ul className={styles.perks}>
          <li>
            <ShieldCheckIcon width={18} height={18} />
            No purchase limit from KYC
          </li>
          <li>
            <ShieldCheckIcon width={18} height={18} />
            Nothing more for you to do
          </li>
        </ul>
        <div className={styles.actions}>
          <Link href={ROUTES.home} className={styles.cta}>
            Continue to home
            <ArrowRightIcon width={18} height={18} />
          </Link>
        </div>
      </KycSplit>
    );
  }

  if (status === 'pending') {
    return (
      <KycSplit
        tone="pending"
        icon={<ClockIcon width={32} height={32} />}
        badge="In review"
        title="KYC under review"
        body="We've received your details. Verification is usually completed shortly, and higher purchase limits unlock once it is approved."
      >
        <h2 className={styles.mainTitle}>Verification progress</h2>
        <ReviewSteps steps={PENDING_STEPS} />
        <div className={styles.actions}>
          <Link href={ROUTES.home} className={styles.linkButton}>
            Back to home
          </Link>
        </div>
      </KycSplit>
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
    <KycSplit
      tone={rejected ? 'danger' : 'neutral'}
      icon={<ShieldIcon width={32} height={32} />}
      badge={rejected ? 'Action needed' : 'Identity check'}
      title="Complete your KYC"
      body={`Required for purchases above ${formatCurrency(KYC_REQUIRED_ABOVE_INR, 'INR')}. We only ask for the last 4 digits of your Aadhaar.`}
      aside={
        <>
          {rejected && (
            <p className={styles.notice} data-variant="danger" role="alert">
              <CloseIcon width={18} height={18} />
              <span>
                Your previous KYC submission was not approved. Please check your
                details and submit again.
              </span>
            </p>
          )}
          <ul className={styles.highlights}>
            <li>
              <ClockIcon width={16} height={16} />
              Takes about a minute
            </li>
            <li>
              <LockIcon width={16} height={16} />
              Only the last 4 Aadhaar digits
            </li>
          </ul>
        </>
      }
    >
      {submitKyc.isPending && (
        <div className={styles.loaderRow}>
          <Loader label="Submitting your KYC" />
        </div>
      )}

      {/* Stays mounted (just hidden) while submitting so entered values survive a failed request. */}
      <div className={styles.formContent} hidden={submitKyc.isPending}>
        <h2 className={styles.mainTitle}>Your details</h2>
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

        <p className={styles.privacy}>
          <LockIcon width={14} height={14} />
          Your details are used only to verify your identity.
        </p>
      </div>
    </KycSplit>
  );
}
