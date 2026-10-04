'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { Modal } from '@/components/common/Modal/Modal';
import { ShieldCheckIcon } from '@/components/common/icons/Icons';
import { useToast } from '@/components/common/Toast/Toast';
import { useCreateRedemption } from '@/features/redemption/hooks/useCreateRedemption';
import {
  createRedemptionSchema,
  type RedemptionFormValues,
} from '@/features/redemption/redemption.schema';
import {
  floorGrams,
  formatGrams,
} from '@/features/redemption/redemption.utils';
import type { Redemption } from '@/features/redemption/redemption.types';
import { describeApiError } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';
import { PickupCodeCard } from './PickupCodeCard';
import styles from './RedeemFlow.module.scss';

const QUICK_GRAMS = [0.5, 1, 5, 10];

const PICKUP_STEPS = ['Request the weight', 'Get your pickup code', 'Collect it in store'];

type Step =
  | { name: 'form' }
  | { name: 'confirm'; grams: number }
  | { name: 'success'; redemption: Redemption };

export function RedeemFlow({ balanceGrams }: { balanceGrams: number }) {
  const { showToast } = useToast();
  const createRedemption = useCreateRedemption();
  const [step, setStep] = useState<Step>({ name: 'form' });

  const maxGrams = floorGrams(balanceGrams);
  const confirmGrams = step.name === 'confirm' ? step.grams : null;
  const schema = useMemo(
    () => createRedemptionSchema(balanceGrams),
    [balanceGrams],
  );

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<RedemptionFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { grams: '' },
  });

  const setGrams = (grams: number) =>
    setValue('grams', String(grams), {
      shouldValidate: true,
      shouldDirty: true,
    });

  const handleConfirm = async (grams: number) => {
    try {
      const result = await createRedemption.mutateAsync({
        weight_grams: grams,
      });
      setStep({ name: 'success', redemption: result.redemption });
    } catch (error) {
      showToast({
        variant: 'danger',
        title: 'Could not create redemption',
        description: describeApiError(error) ?? 'Please try again in a moment.',
      });
    }
  };

  const handleRedeemMore = () => {
    reset({ grams: '' });
    createRedemption.reset();
    setStep({ name: 'form' });
  };

  if (maxGrams <= 0 && step.name === 'form') {
    return (
      <Card className={cn(styles.card, styles.centered)}>
        <h2 className={styles.title}>Redeem physical gold</h2>
        <p className={styles.subtitle}>
          Your vault is empty. Buy some gold first, then come back to collect it
          at the store.
        </p>
        <Link href={ROUTES.home} className={styles.link}>
          Buy gold
        </Link>
      </Card>
    );
  }

  if (step.name === 'success') {
    return (
      <Card className={cn(styles.card, styles.centered)}>
        <span className={styles.successIcon}>
          <ShieldCheckIcon width={24} height={24} />
        </span>
        <h2 className={styles.title}>Redemption requested</h2>
        <p className={styles.subtitle}>
          {formatGrams(step.redemption.weight_grams)} has been taken from your
          vault. Collect it at the store counter.
        </p>
        {step.redemption.pickup_code && (
          <PickupCodeCard code={step.redemption.pickup_code} />
        )}
        <Button type="button" variant="secondary" onClick={handleRedeemMore}>
          Redeem more
        </Button>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <h2 className={styles.title}>Redeem physical gold</h2>
      <p className={styles.subtitle}>
        Customers collect gold in person. Choose how much to take out of your
        vault.
      </p>

      <div className={styles.balanceRow}>
        <span className={styles.balanceLabel}>Available in vault</span>
        <span className={styles.balanceValue}>{formatGrams(balanceGrams)}</span>
      </div>

      <form
        className={styles.form}
        onSubmit={handleSubmit((values) =>
          setStep({ name: 'confirm', grams: Number(values.grams) }),
        )}
        noValidate
      >
        <Input
          label="Weight to redeem (grams)"
          placeholder="0.0000"
          inputMode="decimal"
          autoComplete="off"
          error={errors.grams?.message}
          {...register('grams')}
        />

        <div className={styles.chips}>
          {QUICK_GRAMS.filter((grams) => grams <= maxGrams).map((grams) => (
            <button
              key={grams}
              type="button"
              className={styles.chip}
              onClick={() => setGrams(grams)}
            >
              {grams} g
            </button>
          ))}
          <button
            type="button"
            className={styles.chip}
            onClick={() => setGrams(maxGrams)}
          >
            Max
          </button>
        </div>

        <section className={styles.steps} aria-label="How pickup works">
          <h3 className={styles.stepsTitle}>How pickup works</h3>
          <ol className={styles.stepList}>
            {PICKUP_STEPS.map((text, index) => (
              <li key={text} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden>
                  {index + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>
        </section>

        <Button type="submit" fullWidth disabled={!isValid}>
          Continue
        </Button>
      </form>

      <Modal
        open={step.name === 'confirm'}
        onOpenChange={(open) => {
          if (!open && !createRedemption.isPending) setStep({ name: 'form' });
        }}
        title="Confirm redemption"
        description="Review the details before the gold leaves your vault."
      >
        {confirmGrams !== null &&
          (createRedemption.isPending ? (
            <div className={styles.loaderRow}>
              <Loader label="Creating your redemption" />
            </div>
          ) : (
            <>
              <dl className={styles.summary}>
                <div className={styles.summaryRow}>
                  <dt>Gold to collect</dt>
                  <dd>{formatGrams(confirmGrams)}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Vault balance after</dt>
                  <dd>
                    {formatGrams(Math.max(0, balanceGrams - confirmGrams))}
                  </dd>
                </div>
              </dl>
              <p className={styles.note}>
                The gold is taken from your vault right away. You get a pickup
                code to collect it at the store. You can cancel while it is
                still pending and the gold returns to your vault.
              </p>
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep({ name: 'form' })}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirm(confirmGrams)}
                >
                  Confirm
                </Button>
              </div>
            </>
          ))}
      </Modal>
    </Card>
  );
}
