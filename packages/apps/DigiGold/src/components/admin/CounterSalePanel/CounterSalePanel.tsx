'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Card } from '@/components/common/Card/Card';
import { Input } from '@/components/common/Input/Input';
import { Modal } from '@/components/common/Modal/Modal';
import { useToast } from '@/components/common/Toast/Toast';
import { CustomerPicker } from './CustomerPicker';
import { Stepper } from './Stepper';
import { useLiveRate } from '@/features/market/hooks/useLiveRate';
import { useCounterTrade } from '@/features/admin/hooks/useCounterTrade';
import {
  COUNTER_MAX_GRAMS_DECIMALS,
  COUNTER_MAX_INR_DECIMALS,
  COUNTER_RATE_TOLERANCE_INR,
  decimalPlaces,
  sizeCounterTrade,
} from '@/features/admin/counterTrade.utils';
import type {
  AdminUserSummary,
  CounterPaymentMode,
  CounterTradeReceipt,
} from '@/features/admin/admin.types';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants/routes';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils/cn';
import styles from './CounterSalePanel.module.scss';

type EntryMode = 'amount' | 'grams';

const PAYMENT_OPTIONS: {
  value: CounterPaymentMode;
  label: string;
  hint: string;
}[] = [
  {
    value: 'COUNTER_CASH',
    label: 'Cash',
    hint: 'Cash handed over at the counter',
  },
  { value: 'COUNTER_UPI', label: 'UPI', hint: 'Paid by UPI to the store' },
];

const PAYMENT_LABEL: Record<string, string> = {
  COUNTER_CASH: 'Cash',
  COUNTER_UPI: 'UPI',
};

type Review = {
  // The rate is frozen when the cashier reviews the sale, so the amount they confirm is the
  // amount that is sent even if the live feed ticks in the meantime.
  rate: number;
  weightGrams: number;
  amountInr: number;
};

const QUICK_ADD_INR = [500, 1000, 5000, 10000];
const QUICK_ADD_GRAMS = [0.5, 1, 5, 10];

// Adds a quick-add step to what the cashier has typed, trimmed to the decimals the server keeps.
function addToValue(current: string, step: number, decimals: number): string {
  const base = Number(current);
  const sum = (Number.isFinite(base) && base > 0 ? base : 0) + step;
  return String(Number(sum.toFixed(decimals)));
}

function formatGrams(value: number) {
  return `${value.toFixed(4)} g`;
}

export function CounterSalePanel() {
  const { data: liveRate, status: rateStatus } = useLiveRate();
  const { showToast } = useToast();
  const counterTrade = useCounterTrade();

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState<AdminUserSummary | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>('amount');
  const [value, setValue] = useState('');
  const [paymentMode, setPaymentMode] =
    useState<CounterPaymentMode>('COUNTER_CASH');
  const [review, setReview] = useState<Review | null>(null);
  const [errors, setErrors] = useState<{ customer?: string; value?: string }>(
    {},
  );
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    trade: CounterTradeReceipt;
    customer: AdminUserSummary;
  } | null>(null);

  const liveRatePerGram = liveRate?.pricePerGramInr ?? null;
  // The feed keeps the last tick after a disconnect; selling against it would be guessing.
  const rateUnavailable =
    liveRatePerGram === null ||
    rateStatus === 'closed' ||
    rateStatus === 'error';
  const rateDrifted =
    review !== null &&
    liveRatePerGram !== null &&
    Math.abs(liveRatePerGram - review.rate) > COUNTER_RATE_TOLERANCE_INR;

  const isGrams = entryMode === 'grams';
  const valueEntered = Number(value) > 0;
  const maxDecimals = isGrams
    ? COUNTER_MAX_GRAMS_DECIMALS
    : COUNTER_MAX_INR_DECIMALS;
  const preview =
    liveRatePerGram !== null && Number(value) > 0
      ? sizeCounterTrade(
          liveRatePerGram,
          isGrams
            ? { weightGrams: Number(value) }
            : { amountInr: Number(value) },
        )
      : null;

  function changeEntryMode(next: EntryMode) {
    if (next === entryMode) return;
    setEntryMode(next);
    setValue('');
    setErrors((current) => ({ ...current, value: undefined }));
  }

  function validate(): Review | null {
    const next: { customer?: string; value?: string } = {};
    if (!customer) next.customer = 'Select the customer buying gold.';

    const numeric = Number(value);
    const unit = isGrams ? 'grams' : 'an amount';
    if (!value.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      next.value = `Enter ${unit} greater than zero.`;
    } else if (decimalPlaces(value) > maxDecimals) {
      next.value = isGrams
        ? `Grams can have at most ${maxDecimals} decimal places.`
        : 'Amounts can have at most 2 decimal places.';
    }

    let built: Review | null = null;
    if (!next.value && liveRatePerGram !== null) {
      const rate = Math.round(liveRatePerGram * 100) / 100;
      const sized = sizeCounterTrade(
        rate,
        isGrams ? { weightGrams: numeric } : { amountInr: numeric },
      );
      if (sized) built = { rate, ...sized };
      else
        next.value = 'That is too small to buy any gold at the current rate.';
    }
    setErrors(next);
    return Object.keys(next).length === 0 ? built : null;
  }

  function reviewSale() {
    setFormAlert(null);
    if (rateUnavailable) return;
    const built = validate();
    if (!built) {
      // Send the cashier back to the first step that needs attention.
      setStep(customer ? 2 : 1);
      return;
    }
    setDialogError(null);
    setReview(built);
  }

  function goNext() {
    if (step === 1) {
      if (!customer) {
        setErrors({ customer: 'Select the customer buying gold.' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!validate()) return;
      setStep(3);
    }
  }

  // Enter in the form moves on, and reviews the sale from the last step.
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step < 3) goNext();
    else reviewSale();
  }

  function refreshRate() {
    if (!review || liveRatePerGram === null) return;
    const rate = Math.round(liveRatePerGram * 100) / 100;
    const sized = sizeCounterTrade(
      rate,
      isGrams
        ? { weightGrams: review.weightGrams }
        : { amountInr: review.amountInr },
    );
    if (sized) setReview({ rate, ...sized });
  }

  function closeReview(open: boolean) {
    // Keep the dialog up while the request is in flight so it cannot be dismissed mid-sale.
    if (open || counterTrade.isPending) return;
    setReview(null);
    setDialogError(null);
  }

  function confirmSale() {
    if (!review || !customer || counterTrade.isPending || rateDrifted) return;
    const sale = customer;
    // Send only what the cashier typed; the server sizes the other side at its own rate.
    counterTrade.mutate(
      {
        userId: sale.userId,
        ratePerGram: review.rate,
        paymentMode,
        ...(isGrams
          ? { weightGrams: Number(value) }
          : { amountInr: Number(value) }),
      },
      {
        onSuccess: (trade) => {
          setReview(null);
          setReceipt({ trade, customer: sale });
          showToast({
            title: 'Counter sale recorded',
            description: `${formatGrams(trade.weightGrams)} added to ${sale.name}’s vault.`,
            variant: 'success',
          });
        },
        onError: (error) => {
          const apiError = isNormalizedApiError(error) ? error : null;
          if (apiError?.code === 'SLIPPAGE_EXCEEDED') {
            setReview(null);
            setFormAlert(
              'The live rate moved away from the price shown, so nothing was recorded. Review the sale again at the latest rate. If this keeps happening, the store’s margin may differ from the default used for this estimate.',
            );
            return;
          }
          if (apiError?.status === 404) {
            setReview(null);
            setCustomer(null);
            setStep(1);
            setFormAlert(
              'That customer could not be found in this store. Select them again.',
            );
            return;
          }
          setDialogError(
            describeApiError(error) ??
              'The sale could not be recorded. Please try again.',
          );
        },
      },
    );
  }

  function startNewSale() {
    setReceipt(null);
    setStep(1);
    setCustomer(null);
    setValue('');
    setPaymentMode('COUNTER_CASH');
    setErrors({});
    setFormAlert(null);
    counterTrade.reset();
  }

  return (
    <section className={styles.section} aria-labelledby="counter-sale-title">
      <div className={styles.header}>
        <h2 className={styles.title} id="counter-sale-title">
          Counter sale
        </h2>
      </div>

      <div className={styles.layout}>
        <Card className={styles.formCard}>
          <form
            id="counter-sale-form"
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
          >
            {formAlert && (
              <p className={styles.alert} role="alert">
                {formAlert}
              </p>
            )}

            <Stepper
              current={step}
              steps={[
                { title: 'Customer', done: customer !== null },
                { title: 'Sale details', done: valueEntered },
                {
                  title: 'Payment',
                  done: customer !== null && valueEntered && step === 3,
                },
              ]}
            />

            <div className={styles.stepBody}>
              {step === 1 && (
                <>
                  <CustomerPicker
                    selected={customer}
                    onSelect={(next) => {
                      setCustomer(next);
                      setErrors((current) => ({
                        ...current,
                        customer: undefined,
                      }));
                    }}
                    error={errors.customer}
                  />
                  {customer && customer.kycStatus !== 'verified' && (
                    <p className={styles.notice} role="note">
                      This customer’s KYC is not approved. Customers can’t buy
                      in the app until it is, but a counter sale is still
                      allowed.
                    </p>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <div
                    className={styles.segmented}
                    role="group"
                    aria-label="Enter the sale by"
                  >
                    <button
                      type="button"
                      className={cn(
                        styles.segment,
                        !isGrams && styles.segmentActive,
                      )}
                      aria-pressed={!isGrams}
                      onClick={() => changeEntryMode('amount')}
                    >
                      Amount (₹)
                    </button>
                    <button
                      type="button"
                      className={cn(
                        styles.segment,
                        isGrams && styles.segmentActive,
                      )}
                      aria-pressed={isGrams}
                      onClick={() => changeEntryMode('grams')}
                    >
                      Weight (grams)
                    </button>
                  </div>

                  <div className={styles.amountField}>
                    <Input
                      label={isGrams ? 'Weight in grams' : 'Amount in rupees'}
                      name="counter-value"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={isGrams ? '0.0001' : '0.01'}
                      placeholder={isGrams ? '0.0000' : '0.00'}
                      leftAddon={isGrams ? 'g' : '₹'}
                      value={value}
                      onChange={(event) => {
                        setValue(event.target.value);
                        setErrors((current) => ({
                          ...current,
                          value: undefined,
                        }));
                      }}
                      error={errors.value}
                    />
                  </div>

                  <div className={styles.quickAdd}>
                    <span>Quick add</span>
                    {(isGrams ? QUICK_ADD_GRAMS : QUICK_ADD_INR).map((step) => (
                      <button
                        key={step}
                        type="button"
                        className={styles.chip}
                        aria-label={
                          isGrams ? `Add ${step} grams` : `Add ${step} rupees`
                        }
                        onClick={() => {
                          setValue(addToValue(value, step, maxDecimals));
                          setErrors((current) => ({
                            ...current,
                            value: undefined,
                          }));
                        }}
                      >
                        {isGrams
                          ? `+${step}g`
                          : `+₹${step.toLocaleString('en-IN')}`}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <p className={styles.stepPrompt}>
                    How did {customer?.name ?? 'the customer'} pay?
                  </p>
                  <div
                    className={styles.payOptions}
                    role="group"
                    aria-label="Payment received by"
                  >
                    {PAYMENT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          styles.payCard,
                          paymentMode === option.value && styles.payCardActive,
                        )}
                        aria-label={option.label}
                        aria-pressed={paymentMode === option.value}
                        onClick={() => setPaymentMode(option.value)}
                      >
                        <span className={styles.payRadio} aria-hidden />
                        <span className={styles.payText}>
                          <strong>{option.label}</strong>
                          <span>{option.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <dl className={styles.recap}>
                    <div>
                      <dt>Customer</dt>
                      <dd>{customer?.name}</dd>
                    </div>
                    <div>
                      <dt>Gold</dt>
                      <dd>
                        {preview ? formatGrams(preview.weightGrams) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Collect</dt>
                      <dd>
                        {preview
                          ? formatCurrency(preview.amountInr, 'INR', 2)
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </div>

            <div className={styles.stepNav}>
              <Button
                type="button"
                variant="outlined"
                className={styles.navButton}
                disabled={step === 1}
                onClick={() => setStep((current) => Math.max(1, current - 1))}
              >
                Back
              </Button>
              {step < 3 && (
                <Button
                  type="button"
                  className={styles.navButton}
                  onClick={goNext}
                >
                  Next
                </Button>
              )}
            </div>
          </form>
        </Card>

        <Card className={styles.summaryCard}>
          <div className={styles.rateHeader}>
            <p className={styles.eyebrow}>Live rate · 24K</p>
            <Badge variant={rateStatus === 'open' ? 'success' : 'danger'}>
              {rateStatus === 'open'
                ? 'Live'
                : rateStatus === 'connecting'
                  ? 'Connecting'
                  : 'Disconnected'}
            </Badge>
          </div>
          {liveRatePerGram === null ? (
            <p className={styles.rateValue}>Waiting for rate…</p>
          ) : (
            <p className={styles.rateValue}>
              {formatCurrency(liveRatePerGram, 'INR', 2)}
              <span> / gram</span>
            </p>
          )}
          {liveRate && (
            <dl className={styles.rateBreakdown}>
              <div>
                <dt>Market (MCX ask)</dt>
                <dd>{formatCurrency(liveRate.mcxBaseRateInr, 'INR', 2)}</dd>
              </div>
              <div>
                <dt>Store margin</dt>
                <dd>{formatCurrency(liveRate.marginAppliedInr, 'INR', 2)}</dd>
              </div>
              <div>
                <dt>GST</dt>
                <dd>{formatCurrency(liveRate.gstAppliedInr, 'INR', 2)}</dd>
              </div>
            </dl>
          )}

          <dl className={styles.totals} aria-live="polite">
            <div>
              <dt>Gold to credit</dt>
              <dd>{preview ? formatGrams(preview.weightGrams) : '—'}</dd>
            </div>
            <div className={styles.totalsAmount}>
              <dt>Amount to collect</dt>
              <dd>
                {preview ? formatCurrency(preview.amountInr, 'INR', 2) : '—'}
              </dd>
            </div>
          </dl>

          {rateUnavailable && rateStatus !== 'connecting' && (
            <p className={styles.alert} role="alert">
              The live rate is unavailable, so sales are paused until it
              reconnects.
            </p>
          )}

          <Button
            type="button"
            fullWidth
            className={styles.cta}
            disabled={rateUnavailable}
            onClick={reviewSale}
          >
            Review sale
          </Button>
          <p className={styles.hint}>
            Estimated from the default store margin. The server prices the sale
            itself and refuses it if the rate is more than{' '}
            {formatCurrency(COUNTER_RATE_TOLERANCE_INR, 'INR')} off.
          </p>
        </Card>
      </div>

      <Modal
        open={review !== null}
        onOpenChange={closeReview}
        title="Confirm counter sale"
        description="Check the details and take the payment before you confirm. Gold is credited to the customer’s vault immediately."
      >
        {review && customer && (
          <div className={styles.dialogBody}>
            <dl className={styles.summary}>
              <div>
                <dt>Customer</dt>
                <dd>{customer.name}</dd>
              </div>
              <div>
                <dt>Rate</dt>
                <dd>{formatCurrency(review.rate, 'INR', 2)} / g</dd>
              </div>
              <div>
                <dt>Gold</dt>
                <dd>{formatGrams(review.weightGrams)}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{PAYMENT_LABEL[paymentMode]}</dd>
              </div>
              <div className={styles.summaryTotal}>
                <dt>Collect</dt>
                <dd>{formatCurrency(review.amountInr, 'INR', 2)}</dd>
              </div>
            </dl>
            {rateDrifted && (
              <div className={styles.alert} role="alert">
                <p>The live rate has moved since you reviewed this sale.</p>
                <Button
                  variant="secondary"
                  className={styles.smallButton}
                  onClick={refreshRate}
                >
                  Use latest rate
                </Button>
              </div>
            )}
            {dialogError && (
              <p className={styles.alert} role="alert">
                {dialogError}
              </p>
            )}
            <div className={styles.dialogActions}>
              <Button
                variant="outlined"
                disabled={counterTrade.isPending}
                onClick={() => closeReview(false)}
              >
                Back
              </Button>
              <Button
                isLoading={counterTrade.isPending}
                disabled={rateDrifted || rateUnavailable}
                onClick={confirmSale}
              >
                Confirm sale
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Closing the receipt, by any route, readies the form for the next sale. */}
      <Modal
        open={receipt !== null}
        onOpenChange={(open) => {
          if (!open) startNewSale();
        }}
        title="Counter sale receipt"
      >
        {receipt && (
          <CounterReceipt
            receipt={receipt.trade}
            customer={receipt.customer}
            onNewSale={startNewSale}
          />
        )}
      </Modal>
    </section>
  );
}

function CounterReceipt({
  receipt,
  customer,
  onNewSale,
}: {
  receipt: CounterTradeReceipt;
  customer: AdminUserSummary;
  onNewSale: () => void;
}) {
  return (
    <div className={styles.receipt}>
      <Badge variant="success">Sale recorded</Badge>
      <dl className={styles.summary}>
        <div>
          <dt>Receipt no.</dt>
          <dd>{receipt.id}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{new Date(receipt.createdAt).toLocaleString('en-IN')}</dd>
        </div>
        <div>
          <dt>Customer</dt>
          <dd>
            {customer.name} · {customer.mobileNumber}
          </dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>{PAYMENT_LABEL[receipt.paymentMode] ?? receipt.paymentMode}</dd>
        </div>
        <div>
          <dt>Rate</dt>
          <dd>{formatCurrency(receipt.ratePerGram, 'INR', 2)} / g</dd>
        </div>
        <div>
          <dt>Market rate</dt>
          <dd>{formatCurrency(receipt.mcxBaseRate, 'INR', 2)} / g</dd>
        </div>
        <div>
          <dt>Margin</dt>
          <dd>{formatCurrency(receipt.marginInr, 'INR', 2)} / g</dd>
        </div>
        <div>
          <dt>GST</dt>
          <dd>{formatCurrency(receipt.gstInr, 'INR', 2)} / g</dd>
        </div>
        <div>
          <dt>Gold credited</dt>
          <dd>{formatGrams(receipt.weightGrams)}</dd>
        </div>
        <div>
          <dt>Vault balance now</dt>
          <dd>{formatGrams(receipt.runningGoldBalanceGrams)}</dd>
        </div>
        <div className={styles.summaryTotal}>
          <dt>Amount collected</dt>
          <dd>{formatCurrency(receipt.amountInr, 'INR', 2)}</dd>
        </div>
      </dl>
      <div className={styles.dialogActions}>
        <Link href={ROUTES.adminLedger} className={styles.linkButton}>
          View store ledger
        </Link>
        <Button onClick={onNewSale}>New sale</Button>
      </div>
    </div>
  );
}
