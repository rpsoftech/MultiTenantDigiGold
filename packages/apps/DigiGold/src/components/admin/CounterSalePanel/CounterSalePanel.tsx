'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
import { useCounterQuote } from '@/features/admin/hooks/useCounterQuote';
import { useCounterTrade } from '@/features/admin/hooks/useCounterTrade';
import {
  COUNTER_CASH_LIMIT_INR,
  COUNTER_MAX_GRAMS_DECIMALS,
  COUNTER_MAX_INR_DECIMALS,
  decimalPlaces,
  sizeCounterTrade,
} from '@/features/admin/counterTrade.utils';
import type {
  AdminUserSummary,
  CounterPaymentMode,
  CounterQuote,
  CounterQuoteRequest,
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

// The request may have reached MainServer and recorded the sale. Confirming the same quote
// again is safe: MainServer returns the sale it already recorded instead of a second one.
const NO_REPLY_MESSAGE =
  'No reply from the server, so the sale may already be recorded. Confirm again to find out: the same sale is never recorded twice.';

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

function formatIstTime(epochMs: number) {
  return new Date(epochMs).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function asApiError(error: unknown) {
  return isNormalizedApiError(error) ? error : null;
}

export function CounterSalePanel() {
  const { data: liveRate, status: rateStatus } = useLiveRate();
  const { showToast } = useToast();
  const counterQuote = useCounterQuote();
  const counterTrade = useCounterTrade();

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState<AdminUserSummary | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>('amount');
  const [value, setValue] = useState('');
  const [paymentMode, setPaymentMode] =
    useState<CounterPaymentMode>('COUNTER_CASH');
  // The server's price for the sale; the confirm dialog is open while there is one.
  const [quote, setQuote] = useState<CounterQuote | null>(null);
  const [quoteRequest, setQuoteRequest] = useState<CounterQuoteRequest | null>(
    null,
  );
  const [quoteExpired, setQuoteExpired] = useState(false);
  const [errors, setErrors] = useState<{ customer?: string; value?: string }>(
    {},
  );
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    trade: CounterTradeReceipt;
    customer: AdminUserSummary;
  } | null>(null);

  // A held price can't be confirmed after it expires; say so the moment it does.
  useEffect(() => {
    if (!quote) return;
    const remaining = quote.expiresAt - Date.now();
    if (remaining <= 0) {
      setQuoteExpired(true);
      return;
    }
    const timer = setTimeout(() => setQuoteExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [quote]);

  const liveRatePerGram = liveRate?.pricePerGramInr ?? null;
  // The feed keeps the last tick after a disconnect; selling against it would be guessing.
  const rateUnavailable =
    liveRatePerGram === null ||
    rateStatus === 'closed' ||
    rateStatus === 'error';

  const isGrams = entryMode === 'grams';
  const valueEntered = Number(value) > 0;
  const maxDecimals = isGrams
    ? COUNTER_MAX_GRAMS_DECIMALS
    : COUNTER_MAX_INR_DECIMALS;
  // An estimate from the market feed; the confirm dialog shows the store's exact price.
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

  // Checks the form and returns what to price, or null with the problems shown.
  function validate(): CounterQuoteRequest | null {
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
    } else if (
      liveRatePerGram !== null &&
      !sizeCounterTrade(
        liveRatePerGram,
        isGrams ? { weightGrams: numeric } : { amountInr: numeric },
      )
    ) {
      // Without a rate yet, the server makes this check when it prices the sale.
      next.value = 'That is too small to buy any gold at the current rate.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !customer) return null;
    return {
      userId: customer.userId,
      paymentMode,
      ...(isGrams ? { weightGrams: numeric } : { amountInr: numeric }),
    };
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

  // The customer vanished from this store (404): start over from the customer step.
  function customerGone() {
    setQuote(null);
    setCustomer(null);
    setStep(1);
    setFormAlert(
      'That customer could not be found in this store. Select them again.',
    );
  }

  // Too much cash for one customer today: back to the payment step to take UPI instead.
  function cashLimitReached(message: string) {
    setQuote(null);
    setStep(3);
    setFormAlert(message);
  }

  function requestQuote(request: CounterQuoteRequest) {
    setFormAlert(null);
    setDialogError(null);
    setQuoteRequest(request);
    counterQuote.mutate(request, {
      onSuccess: (next) => {
        setQuoteExpired(false);
        setQuote(next);
      },
      onError: (error) => {
        const apiError = asApiError(error);
        if (apiError?.code === 'CASH_LIMIT_EXCEEDED') {
          cashLimitReached(apiError.message);
          return;
        }
        if (apiError?.status === 404) {
          customerGone();
          return;
        }
        const message =
          describeApiError(error) ??
          'The sale could not be priced. Please try again.';
        // A refreshed price failed while the dialog is open: show it there.
        if (quote) setDialogError(message);
        else setFormAlert(message);
      },
    });
  }

  function reviewSale() {
    setFormAlert(null);
    if (rateUnavailable || counterQuote.isPending) return;
    const request = validate();
    if (!request) {
      // Send the cashier back to the first step that needs attention.
      setStep(customer ? 2 : 1);
      return;
    }
    requestQuote(request);
  }

  function closeReview(open: boolean) {
    // Keep the dialog up while the request is in flight so it cannot be dismissed mid-sale.
    if (open || counterTrade.isPending) return;
    setQuote(null);
    setDialogError(null);
  }

  function confirmSale() {
    if (!quote || !customer || counterTrade.isPending || quoteExpired) return;
    const sale = customer;
    setDialogError(null);
    counterTrade.mutate(quote.quoteId, {
      onSuccess: (trade) => {
        setQuote(null);
        setReceipt({ trade, customer: sale });
        showToast(
          trade.alreadyRecorded
            ? {
                title: 'Sale was already recorded',
                description: 'Nothing was recorded twice.',
                variant: 'success',
              }
            : {
                title: 'Counter sale recorded',
                description: `${formatGrams(trade.weightGrams)} added to ${sale.name}’s vault.`,
                variant: 'success',
              },
        );
      },
      onError: (error) => {
        const apiError = asApiError(error);
        if (apiError?.code === 'COUNTER_QUOTE_EXPIRED') {
          setQuoteExpired(true);
          return;
        }
        if (apiError?.code === 'CASH_LIMIT_EXCEEDED') {
          cashLimitReached(apiError.message);
          return;
        }
        if (apiError?.status === 404) {
          customerGone();
          return;
        }
        if (apiError?.status === null) {
          setDialogError(NO_REPLY_MESSAGE);
          return;
        }
        setDialogError(
          describeApiError(error) ??
            'The sale could not be recorded. Please try again.',
        );
      },
    });
  }

  function startNewSale() {
    setReceipt(null);
    setStep(1);
    setCustomer(null);
    setValue('');
    setPaymentMode('COUNTER_CASH');
    setErrors({});
    setFormAlert(null);
    setQuoteRequest(null);
    counterQuote.reset();
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
                  {customer?.kycStatus === 'rejected' && (
                    <p className={styles.notice} role="note">
                      This customer’s KYC was rejected. Check their identity
                      documents in person before selling to them at the counter.
                    </p>
                  )}
                  {customer &&
                    customer.kycStatus !== 'verified' &&
                    customer.kycStatus !== 'rejected' && (
                      <p className={styles.notice} role="note">
                        This customer’s KYC is not approved yet. Customers can’t
                        buy in the app until it is, but a counter sale is still
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
                  <p className={styles.hint}>
                    By law, cash from one customer must stay under{' '}
                    {formatCurrency(COUNTER_CASH_LIMIT_INR, 'INR')} a day; take
                    the rest by UPI.
                  </p>
                  <dl className={styles.recap}>
                    <div>
                      <dt>Customer</dt>
                      <dd>{customer?.name}</dd>
                    </div>
                    <div>
                      <dt>Gold (estimate)</dt>
                      <dd>
                        {preview ? formatGrams(preview.weightGrams) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Amount (estimate)</dt>
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
            isLoading={counterQuote.isPending && !quote}
            onClick={reviewSale}
          >
            Review sale
          </Button>
          <p className={styles.hint}>
            An estimate at the default store margin. Review sale gets the
            store’s exact price, which is what you collect.
          </p>
        </Card>
      </div>

      <Modal
        open={quote !== null}
        onOpenChange={closeReview}
        title="Confirm counter sale"
        description="Collect exactly this amount, then confirm. Gold is credited to the customer’s vault immediately."
      >
        {quote && customer && (
          <div className={styles.dialogBody}>
            <dl className={styles.summary}>
              <div>
                <dt>Customer</dt>
                <dd>{customer.name}</dd>
              </div>
              <div>
                <dt>Rate</dt>
                <dd>{formatCurrency(quote.ratePerGram, 'INR', 2)} / g</dd>
              </div>
              <div>
                <dt>Gold</dt>
                <dd>{formatGrams(quote.weightGrams)}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{PAYMENT_LABEL[quote.paymentMode]}</dd>
              </div>
              <div className={styles.summaryTotal}>
                <dt>Collect</dt>
                <dd>{formatCurrency(quote.amountInr, 'INR', 2)}</dd>
              </div>
            </dl>
            {quoteExpired ? (
              <div className={styles.alert} role="alert">
                <p>
                  This price has expired. Get a new price before you take the
                  payment.
                </p>
                <Button
                  variant="secondary"
                  className={styles.smallButton}
                  isLoading={counterQuote.isPending}
                  onClick={() => quoteRequest && requestQuote(quoteRequest)}
                >
                  Get a new price
                </Button>
              </div>
            ) : (
              <p className={styles.hint}>
                Price held until {formatIstTime(quote.expiresAt)} IST.
              </p>
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
                disabled={quoteExpired}
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
      {receipt.alreadyRecorded && (
        <p className={styles.notice} role="note">
          This sale had already been recorded; nothing was recorded twice.
        </p>
      )}
      <dl className={styles.summary}>
        <div>
          <dt>Receipt no.</dt>
          <dd>{receipt.id}</dd>
        </div>
        <div>
          <dt>Date (IST)</dt>
          <dd>
            {new Date(receipt.createdAt).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
            })}
          </dd>
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
          <dd>{formatCurrency(receipt.marginPerGramInr, 'INR', 2)} / g</dd>
        </div>
        <div>
          <dt>GST</dt>
          <dd>{formatCurrency(receipt.gstPerGramInr, 'INR', 2)} / g</dd>
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
