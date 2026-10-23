'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { OtpInputCells } from '@/components/common/OtpInputCells/OtpInputCells';
import { CountdownTimer } from '@/components/common/CountdownTimer/CountdownTimer';
import { PencilIcon, ArrowRightIcon, ShieldIcon, LockIcon, ClockIcon } from '@/components/common/icons/Icons';
import { useToast } from '@/components/common/Toast/Toast';
import { useVerifyOtp } from '@/features/auth/hooks/useVerifyOtp';
import { useRequestOtp } from '@/features/auth/hooks/useRequestOtp';
import { OTP_PATTERN } from '@/lib/constants/regex';
import { ROUTES } from '@/lib/constants/routes';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';
import styles from './OtpForm.module.scss';

// Every OTP rate-limit case (30s resend cooldown, max resend attempts, max verify
// attempts, generic per-IP limiter) returns HTTP 429 with a real, user-facing `message`
// from MainServer (see interfaces/error_translator.go) — show that instead of a generic
// string so the user knows it's a cooldown/lockout, not a wrong code.
function rateLimitMessage(error: unknown): string | undefined {
  if (!isNormalizedApiError(error) || error.status !== 429) return undefined;
  return error.message;
}

// Why a verify attempt failed. A wrong code (401) is the only case the customer fixes by
// retyping; a dropped connection or a server fault needs different advice, and a lockout is
// a wait, not a typo.
function verifyFailure(error: unknown): { title: string; description: string } {
  const cooldownMessage = rateLimitMessage(error);
  if (cooldownMessage) {
    return { title: 'Too many attempts', description: cooldownMessage };
  }
  if (isNormalizedApiError(error) && (error.status === null || error.status >= 500)) {
    return {
      title: 'Could not verify the code',
      description: describeApiError(error) ?? 'Please try again in a moment.',
    };
  }
  return { title: 'Incorrect OTP', description: 'Please check the code and try again.' };
}

const RESEND_COOLDOWN_SECONDS = 30;

export type OtpFormProps = {
  mobileNumber: string;
  successRoute?: string;
  loginRoute?: string;
  onEditNumber?: () => void;
};

export function OtpForm({
  mobileNumber,
  successRoute,
  loginRoute = ROUTES.login,
  onEditNumber,
}: OtpFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const verifyOtp = useVerifyOtp();
  const requestOtp = useRequestOtp();

  const [otp, setOtp] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [cooldownKey, setCooldownKey] = useState(0);
  // Also shown inline: on a phone the on-screen keyboard covers the toast at the bottom.
  const [failure, setFailure] = useState<string | null>(null);

  const isComplete = OTP_PATTERN.test(otp);

  const handleVerify = async () => {
    if (!isComplete || verifyOtp.isPending) return;
    setFailure(null);
    try {
      const result = await verifyOtp.mutateAsync({ mobileNumber, otp });
      router.push(
        successRoute ?? (result.is_registered ? ROUTES.home : ROUTES.profileSetup)
      );
    } catch (error) {
      const { title, description } = verifyFailure(error);
      setFailure(description);
      showToast({ variant: 'danger', title, description });
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setOtp('');
    setFailure(null);
    setCanResend(false);
    setCooldownKey((key) => key + 1);
    try {
      const result = await requestOtp.mutateAsync({ mobileNumber });
      showToast({
        variant: 'success',
        title: 'OTP resent',
        description: result.dev_otp ? `Local code: ${result.dev_otp}` : undefined,
      });
    } catch (error) {
      const cooldownMessage = rateLimitMessage(error);
      showToast({
        variant: 'danger',
        title: cooldownMessage ? 'Please wait' : 'Could not resend OTP',
        description: cooldownMessage ?? describeApiError(error) ?? undefined,
      });
    }
  };

  return (
    <Card className={styles.card}>
      <span className={styles.iconBadge}>
        <ShieldIcon width={22} height={22} />
      </span>

      <h1 className={styles.title}>Verify your identity</h1>
      <p className={styles.subtitle}>Enter the 6-digit code sent to</p>

      <span className={styles.mobilePill}>
        +91 {formatMobileNumber(mobileNumber)}
        <button
          type="button"
          className={styles.editButton}
          onClick={onEditNumber ?? (() => router.push(loginRoute))}
          aria-label="Edit mobile number"
        >
          <PencilIcon width={14} height={14} />
        </button>
      </span>

      <OtpInputCells
        value={otp}
        onChange={(next) => {
          setFailure(null);
          setOtp(next);
        }}
        error={verifyOtp.isError}
        onSubmit={handleVerify}
      />

      {failure && (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}

      <div className={styles.resendRow}>
        {canResend ? (
          <button type="button" className={styles.resendLink} onClick={handleResend}>
            Resend Code
          </button>
        ) : (
          <span className={styles.resendCountdown}>
            <ClockIcon width={13} height={13} /> Resend OTP in{' '}
            <CountdownTimer
              key={cooldownKey}
              seconds={RESEND_COOLDOWN_SECONDS}
              onExpire={() => setCanResend(true)}
            />
          </span>
        )}
      </div>

      <Button fullWidth isLoading={verifyOtp.isPending} disabled={!isComplete} onClick={handleVerify}>
        Verify &amp; Proceed <ArrowRightIcon width={16} height={16} />
      </Button>

      <div className={styles.trustRow}>
        <LockIcon width={13} height={13} />
        <span>End-to-End Encrypted</span>
      </div>
    </Card>
  );
}
