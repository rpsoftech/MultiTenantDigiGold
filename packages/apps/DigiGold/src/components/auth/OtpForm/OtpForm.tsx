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
import styles from './OtpForm.module.scss';

const RESEND_COOLDOWN_SECONDS = 30;

export type OtpFormProps = {
  mobileNumber: string;
};

export function OtpForm({ mobileNumber }: OtpFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const verifyOtp = useVerifyOtp();
  const requestOtp = useRequestOtp();

  const [otp, setOtp] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [cooldownKey, setCooldownKey] = useState(0);

  const isComplete = OTP_PATTERN.test(otp);

  const handleVerify = async () => {
    try {
      const result = await verifyOtp.mutateAsync({ mobileNumber, otp });
      router.push(result.user.isNewUser ? ROUTES.profileSetup : ROUTES.home);
    } catch {
      showToast({
        variant: 'danger',
        title: 'Incorrect OTP',
        description: 'Please check the code and try again.',
      });
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setOtp('');
    setCanResend(false);
    setCooldownKey((key) => key + 1);
    try {
      await requestOtp.mutateAsync({ mobileNumber });
      showToast({ variant: 'success', title: 'OTP resent' });
    } catch {
      showToast({ variant: 'danger', title: 'Could not resend OTP' });
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
          onClick={() => router.push(ROUTES.login)}
          aria-label="Edit mobile number"
        >
          <PencilIcon width={14} height={14} />
        </button>
      </span>

      <OtpInputCells value={otp} onChange={setOtp} error={verifyOtp.isError} />

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
