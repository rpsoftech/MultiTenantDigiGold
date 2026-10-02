'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { QRCodeSVG } from 'qrcode.react';
import { z } from 'zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import {
  ArrowRightIcon,
  LockFilledIcon,
  EyeIcon,
  EyeOffIcon,
} from '@/components/common/icons/Icons';
import { useToast } from '@/components/common/Toast/Toast';
import { useAdminLogin } from '@/features/admin-auth/hooks/useAdminLogin';
import { useAdminTotpSetup } from '@/features/admin-auth/hooks/useAdminTotpSetup';
import { useAdminTotpVerify } from '@/features/admin-auth/hooks/useAdminTotpVerify';
import { ROUTES } from '@/lib/constants/routes';
import styles from './AdminLoginForm.module.scss';

const adminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type AdminLoginFormValues = z.infer<typeof adminLoginSchema>;
type LoginStep = 'credentials' | 'setup' | 'verify' | 'complete';

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return fallback;
}

function isInvalidTemporaryToken(error: unknown): boolean {
  const message = getErrorMessage(error, '');
  return /(?:invalid|expired).*temp(?:orary)?[ _-]?token|temp(?:orary)?[ _-]?token.*(?:invalid|expired)/i.test(
    message,
  );
}

function getEnrollmentSecret(uri: string): string {
  const enrollment = new URL(uri);
  const secret = enrollment.searchParams.get('secret');
  if (
    enrollment.protocol !== 'otpauth:' ||
    enrollment.hostname !== 'totp' ||
    !secret
  ) {
    throw new Error(
      'The server returned an invalid authenticator enrollment. Please try again.',
    );
  }
  return secret;
}

export function AdminLoginForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const adminLogin = useAdminLogin();
  const setupTotp = useAdminTotpSetup();
  const verifyTotp = useAdminTotpVerify();
  const requestInFlight = useRef(false);
  const [step, setStep] = useState<LoginStep>('credentials');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<{
    uri: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isValid },
  } = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginSchema),
    mode: 'onChange',
    defaultValues: { username: '', password: '' },
  });

  const restartLogin = () => {
    setTempToken(null);
    setEnrollment(null);
    setCode('');
    setError(null);
    setShowPassword(false);
    resetField('password');
    adminLogin.reset();
    setupTotp.reset();
    verifyTotp.reset();
    setStep('credentials');
  };

  const reportError = (
    cause: unknown,
    title: string,
    fallback: string,
    displayMessage?: string,
  ) => {
    const message = isInvalidTemporaryToken(cause)
      ? 'Your sign-in session expired. Enter your password to start again.'
      : (displayMessage ?? getErrorMessage(cause, fallback));
    if (isInvalidTemporaryToken(cause)) restartLogin();
    setError(message);
    showToast({ variant: 'danger', title, description: message });
  };

  const prepareAuthenticator = async (token: string) => {
    setStep('setup');
    setError(null);
    try {
      const result = await setupTotp.mutateAsync({ temp_token: token });
      setEnrollment(
        result
          ? {
              uri: result.otpauth_uri,
              secret: getEnrollmentSecret(result.otpauth_uri),
            }
          : null,
      );
      setStep('verify');
    } catch (cause) {
      reportError(
        cause,
        'Could not prepare authenticator',
        'Please try setting up your authenticator again.',
      );
    } finally {
      setupTotp.reset();
    }
  };

  const onSubmit = async (values: AdminLoginFormValues) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await adminLogin.mutateAsync(values);
      resetField('password');
      setShowPassword(false);
      adminLogin.reset();
      setTempToken(result.temp_token);
      await prepareAuthenticator(result.temp_token);
    } catch (cause) {
      reportError(
        cause,
        'Could not sign in',
        'Please check your username and password and try again.',
      );
    } finally {
      adminLogin.reset();
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const retrySetup = async () => {
    if (!tempToken || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    try {
      await prepareAuthenticator(tempToken);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const onVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tempToken || !/^\d{6}$/.test(code) || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await verifyTotp.mutateAsync({ temp_token: tempToken, code });
      setTempToken(null);
      setEnrollment(null);
      setCode('');
      setStep('complete');
      router.push(ROUTES.adminDashboard);
    } catch (cause) {
      const invalidCode =
        getErrorMessage(cause, '').trim().toLowerCase() === 'invalid totp code';
      reportError(
        cause,
        'Could not verify code',
        'Please check the code in your authenticator and try again.',
        invalidCode
          ? enrollment
            ? 'That code wasn’t accepted. Scan the QR code shown here and enter a fresh six-digit code for that account. If it still fails, set your device’s date and time to automatic.'
            : 'That code wasn’t accepted. Enter a fresh six-digit code for your DigiGold admin account. If it still fails, set your device’s date and time to automatic.'
          : undefined,
      );
      setCode('');
    } finally {
      verifyTotp.reset();
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const title =
    step === 'credentials'
      ? 'Admin Login'
      : step === 'setup'
        ? 'Prepare your authenticator'
        : step === 'complete'
          ? 'Signed in'
          : enrollment
            ? 'Set up your authenticator'
            : 'Verify your identity';
  const subtitle =
    step === 'credentials'
      ? 'Sign in with your admin username and password'
      : step === 'setup'
        ? 'Checking your authenticator setup'
        : step === 'complete'
          ? 'Opening your admin dashboard…'
          : enrollment
            ? 'Scan this QR code with your authenticator app, then enter its six-digit code.'
            : 'Enter the six-digit code from your authenticator app.';

  return (
    <Card className={styles.card} aria-labelledby="admin-login-title">
      <span className={styles.iconBadge}>
        <LockFilledIcon width={24} height={24} />
      </span>

      <h1 id="admin-login-title" className={styles.title}>
        {title}
      </h1>
      <p className={styles.subtitle}>{subtitle}</p>

      {error && (
        <p id="admin-login-error" className={styles.error} role="alert">
          {error}
        </p>
      )}

      {step === 'credentials' && (
        <form
          className={styles.form}
          onSubmit={handleSubmit(onSubmit)}
          aria-busy={busy}
        >
          <Input
            label="Username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="demo-manager"
            disabled={busy}
            error={errors.username?.message}
            {...register('username')}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={busy}
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

          <Button
            type="submit"
            fullWidth
            isLoading={busy}
            disabled={!isValid}
            aria-label="Sign In"
          >
            Sign In <ArrowRightIcon width={16} height={16} />
          </Button>
          {busy && (
            <p className={styles.status} role="status">
              Checking your credentials…
            </p>
          )}
        </form>
      )}

      {step === 'setup' && (
        <div className={styles.form} aria-busy={busy}>
          {busy ? (
            <p className={styles.status} role="status">
              Preparing your authenticator…
            </p>
          ) : (
            <Button type="button" fullWidth onClick={retrySetup}>
              Retry setup
            </Button>
          )}
        </div>
      )}

      {step === 'verify' && (
        <>
          {enrollment && (
            <div className={styles.enrollment}>
              <div className={styles.qrCode}>
                <QRCodeSVG
                  value={enrollment.uri}
                  size={192}
                  marginSize={4}
                  role="img"
                  aria-label="Authenticator enrollment QR code"
                />
              </div>
              <details className={styles.manualSetup}>
                <summary>Can’t scan the QR code?</summary>
                <p>
                  Enter this setup key in your authenticator app and choose a
                  time-based code.
                </p>
                <code className={styles.secret}>{enrollment.secret}</code>
              </details>
            </div>
          )}
          <form className={styles.form} onSubmit={onVerify} aria-busy={busy}>
            <Input
              id="admin-authenticator-code"
              label="Authenticator code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              value={code}
              disabled={busy}
              aria-describedby={error ? 'admin-login-error' : undefined}
              aria-invalid={Boolean(error)}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              autoFocus
            />
            {process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH === 'true' && (
              <p className={styles.status}>Demo authenticator code: 123456</p>
            )}
            <Button
              type="submit"
              fullWidth
              isLoading={busy}
              disabled={!/^\d{6}$/.test(code)}
              aria-label="Verify and sign in"
            >
              Verify and sign in <ArrowRightIcon width={16} height={16} />
            </Button>
            {busy && (
              <p className={styles.status} role="status">
                Verifying your code…
              </p>
            )}
          </form>
        </>
      )}

      {(step === 'setup' || step === 'verify') && (
        <button
          type="button"
          className={styles.backButton}
          disabled={busy}
          onClick={restartLogin}
        >
          Back to sign in
        </button>
      )}
      {step === 'complete' && (
        <p className={styles.status} role="status">
          Authentication complete.
        </p>
      )}
    </Card>
  );
}
