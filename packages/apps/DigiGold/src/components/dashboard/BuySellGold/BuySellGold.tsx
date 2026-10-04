'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { CountdownTimer } from '@/components/common/CountdownTimer/CountdownTimer';
import { ClockIcon, CloseIcon, CoinsIcon } from '@/components/common/icons/Icons';
import { useToast } from '@/components/common/Toast/Toast';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useLiveRate } from '@/features/market/hooks/useLiveRate';
import { useSession } from '@/features/auth/hooks/useSession';
import { useInitiateBuy } from '@/features/trade/hooks/useInitiateBuy';
import { useBuySettlement } from '@/features/trade/hooks/useBuySettlement';
import {
  loadRazorpayScript,
  openRazorpayCheckout,
  type RazorpayInstance,
} from '@/lib/payments/razorpay';
import type { InitiateBuyResult } from '@/features/trade/trade.types';
import type { NormalizedApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';
import styles from './BuySellGold.module.scss';

const QUICK_ADD_GRAMS = [0.5, 1, 5, 10];
const QUICK_ADD_INR = [1000, 5000, 10000, 25000];
const NUMERIC_INPUT_PATTERN = /^\d*\.?\d*$/;
const KYC_GATED_AMOUNT_INR = 50000;

type BuyMode = 'grams' | 'inr';
type PaymentStage = 'idle' | 'awaiting-payment' | 'polling' | 'cancelled' | 'timeout';

function secondsUntil(unixSeconds: number): number {
  return Math.max(0, Math.round(unixSeconds - Date.now() / 1000));
}

function startPaymentErrorTitle(error: Partial<NormalizedApiError>): string {
  if (error.status === 403) return 'KYC verification required';
  // Live rate moved more than the server's slippage tolerance from the rate shown here.
  if (error.code === 'SLIPPAGE_EXCEEDED') return 'Price changed';
  return 'Could not start payment';
}

export function BuySellGold() {
  const router = useRouter();
  const tenantConfig = useTenantConfig();
  const { showToast } = useToast();
  const { isAuthenticated, user } = useSession();
  const { data: rate, isLoading } = useLiveRate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<BuyMode>('grams');
  const [gramsInput, setGramsInput] = useState('1');
  const [quote, setQuote] = useState<InitiateBuyResult | null>(null);
  // Captured once when the quote arrives — CountdownTimer restarts whenever `seconds`
  // changes, so this must not be recomputed on every render.
  const [quoteLockSeconds, setQuoteLockSeconds] = useState(0);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [stage, setStage] = useState<PaymentStage>('idle');
  const checkoutRef = useRef<RazorpayInstance | null>(null);

  const initiateBuy = useInitiateBuy();
  const settlement = useBuySettlement(stage === 'polling' ? paymentId : null);

  useEffect(() => () => checkoutRef.current?.close(), []);

  // rate.pricePerGramInr is a CLIENT-SIDE ESTIMATE: MainServer's rate feed only returns the
  // raw MCX ask, so features/market/tenantPricing.ts layers the platform's default margin
  // (₹100 flat) + GST (3%) on top to approximate what the tenant will actually charge. If
  // this tenant's admin-configured margin differs from the default, this display — and the
  // requested_rate_per_gram sent below — will disagree with the server's real price and can
  // still trigger a slippage rejection. See tenantPricing.ts for why this can't be exact
  // without a backend change.
  const pricePerGram = rate?.pricePerGramInr ?? 0;
  const grams = Number(gramsInput) || 0;
  const totalInr = grams * pricePerGram;
  const baseAmountInr = grams * (rate?.mcxBaseRateInr ?? 0);
  const marginAmountInr = grams * (rate?.marginAppliedInr ?? 0);
  const gstAmountInr = grams * (rate?.gstAppliedInr ?? 0);
  const inrInputValue = totalInr ? totalInr.toFixed(2) : '';

  const kycBlocked =
    totalInr > KYC_GATED_AMOUNT_INR && (user?.kycStatus ?? 'not_started') !== 'verified';

  const settlementStatus = stage === 'polling' ? settlement.status : null;

  const resetForm = () => {
    setGramsInput('1');
    setQuote(null);
    setPaymentId(null);
    setStage('idle');
  };

  // MainServer refunds any payment captured after the quote expires (pg_service.go), so
  // once the lock runs out the open checkout can only produce a charge-then-refund — close
  // it rather than let the customer pay. Stage is set first so the resulting ondismiss
  // doesn't flip it to 'cancelled'.
  const handleQuoteExpired = () => {
    if (stage !== 'awaiting-payment') return;
    setQuote(null);
    setStage('idle');
    checkoutRef.current?.close();
    checkoutRef.current = null;
    showToast({
      variant: 'danger',
      title: 'Price lock expired',
      description: 'Proceed again to get a fresh price.',
    });
  };

  const handleGramsChange = (value: string) => {
    if (NUMERIC_INPUT_PATTERN.test(value)) setGramsInput(value);
  };

  const handleInrChange = (value: string) => {
    if (!NUMERIC_INPUT_PATTERN.test(value)) return;
    const inrValue = Number(value) || 0;
    setGramsInput(pricePerGram ? (inrValue / pricePerGram).toFixed(4) : '0');
  };

  const handleQuickAddGrams = (increment: number) => {
    setGramsInput((grams + increment).toFixed(4));
  };

  const handleQuickAddInr = (increment: number) => {
    const nextInr = totalInr + increment;
    setGramsInput(pricePerGram ? (nextInr / pricePerGram).toFixed(4) : '0');
  };

  const handleProceed = async () => {
    if (!isAuthenticated) {
      router.push(ROUTES.login);
      return;
    }
    if (kycBlocked) return;

    // Checked before initiating so a misconfigured deployment doesn't create a backend
    // order (and Razorpay order) on every click that can never be paid.
    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) {
      showToast({
        variant: 'danger',
        title: 'Payment unavailable',
        description: 'Checkout is not configured for this deployment.',
      });
      return;
    }

    try {
      // Backend prices buys by amount only — the grams shown here are a display estimate
      // until the quote comes back.
      const result = await initiateBuy.mutateAsync({
        total_amount_inr: Math.round(totalInr * 100) / 100,
        requested_rate_per_gram: pricePerGram,
      });
      setQuote(result);
      setQuoteLockSeconds(secondsUntil(result.quote_expires_at));
      setStage('awaiting-payment');

      const Razorpay = await loadRazorpayScript();
      checkoutRef.current = openRazorpayCheckout(Razorpay, {
        key: razorpayKeyId,
        amount: Math.round(result.amount * 100),
        currency: 'INR',
        order_id: result.order_id,
        name: tenantConfig?.displayName,
        description: `${result.weight_grams.toFixed(4)}g gold purchase`,
        prefill: { contact: user?.mobileNumber ?? undefined },
        theme: { color: tenantConfig?.theme.colors.primary },
        handler: (response) => {
          checkoutRef.current = null;
          setPaymentId(response.razorpay_payment_id);
          setStage('polling');
        },
        modal: {
          ondismiss: () => {
            checkoutRef.current = null;
            setStage((current) => (current === 'awaiting-payment' ? 'cancelled' : current));
          },
        },
      }, (failure) => {
        showToast({
          variant: 'danger',
          title: 'Payment failed',
          description: failure.error.description,
        });
      });
    } catch (error) {
      setStage('idle');
      const normalized = error as Partial<NormalizedApiError>;
      if (normalized.code === 'SLIPPAGE_EXCEEDED') {
        void queryClient.invalidateQueries({ queryKey: ['market', 'last-rate'] });
      }
      showToast({
        variant: 'danger',
        title: startPaymentErrorTitle(normalized),
        description: normalized.message ?? 'Please try again in a moment.',
      });
    }
  };

  useEffect(() => {
    if (settlementStatus === 'settled') {
      showToast({
        variant: 'success',
        title: 'Gold credited',
        description: settlement.entry
          ? `${settlement.entry.weight_grams.toFixed(4)}g added to your vault.`
          : 'Your purchase is complete.',
      });
      queryClient.invalidateQueries({ queryKey: ['trade', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'portfolio'] });
      resetForm();
    } else if (settlementStatus === 'timeout') {
      setStage('timeout');
    }
  }, [settlementStatus]);

  const proceedDisabled =
    grams <= 0 || isLoading || initiateBuy.isPending || stage === 'awaiting-payment' || stage === 'polling';

  const proceedLabel = useMemo(() => {
    if (!isAuthenticated) return 'Login to Proceed';
    if (initiateBuy.isPending) return 'Locking price…';
    if (stage === 'awaiting-payment') return 'Waiting for payment…';
    if (stage === 'polling') return 'Confirming payment…';
    return `Proceed to Pay ${formatCurrency(totalInr, 'INR')}`;
  }, [isAuthenticated, initiateBuy.isPending, stage, totalInr]);

  // Must stay below every hook: tenantConfig starts as the static default (trading on) and
  // can flip once /tenant/info resolves — an earlier return would change the hook count.
  if (tenantConfig && !tenantConfig.activeModules.trading) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Buy Gold</h2>

      <Card className={styles.card}>
        <div className={styles.headerRow}>
          <div>
            <div className={styles.titleRow}>
              <h3 className={styles.title}>Spot Gold Purchase</h3>
              <Badge variant="brand">{rate?.purityLabel ?? '24K • 99.99%'}</Badge>
            </div>
            {isLoading || !rate ? (
              <Loader size="sm" label="Loading live rate" />
            ) : (
              <p className={styles.rateRow}>
                Live Market Rate: <strong>{formatCurrency(rate.pricePerGramInr, 'INR')}/g</strong>
              </p>
            )}
          </div>

          {/* quoteLockSeconds is 0 only if the client clock is far ahead of the server's —
              hide the timer then rather than expire a quote the server still honours. */}
          {quote && stage === 'awaiting-payment' && quoteLockSeconds > 0 && (
            <div className={styles.priceLock}>
              <span className={styles.priceLockLabel}>
                <ClockIcon width={12} height={12} /> Price Locked
              </span>
              <CountdownTimer
                key={quote.order_id}
                seconds={quoteLockSeconds}
                onExpire={handleQuoteExpired}
                className={styles.priceLockTimer}
              />
            </div>
          )}
        </div>

        <div className={styles.toggleRow}>
          <button
            type="button"
            className={cn(styles.toggleButton, mode === 'inr' && styles.toggleButtonActive)}
            onClick={() => setMode('inr')}
          >
            Buy in Rupees (₹)
          </button>
          <button
            type="button"
            className={cn(styles.toggleButton, mode === 'grams' && styles.toggleButtonActive)}
            onClick={() => setMode('grams')}
          >
            Buy in Grams (g)
          </button>
        </div>

        {mode === 'grams' ? (
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="buy-sell-grams">
              Enter Gold Weight (Grams)
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputAddon}>g</span>
              <input
                id="buy-sell-grams"
                className={styles.input}
                inputMode="decimal"
                value={gramsInput}
                onChange={(event) => handleGramsChange(event.target.value)}
              />
              <button
                type="button"
                className={styles.clearButton}
                aria-label="Clear gold weight"
                onClick={() => setGramsInput('')}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="buy-sell-inr">
              Enter Amount (₹)
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputAddon}>₹</span>
              <input
                id="buy-sell-inr"
                className={styles.input}
                inputMode="decimal"
                value={inrInputValue}
                onChange={(event) => handleInrChange(event.target.value)}
              />
              <button
                type="button"
                className={styles.clearButton}
                aria-label="Clear amount"
                onClick={() => setGramsInput('')}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
          </div>
        )}

        <div className={styles.quickAddRow}>
          <span className={styles.quickAddLabel}>Quick Add:</span>
          {mode === 'grams'
            ? QUICK_ADD_GRAMS.map((increment) => (
                <button
                  key={increment}
                  type="button"
                  className={styles.quickAddChip}
                  onClick={() => handleQuickAddGrams(increment)}
                >
                  +{increment}g
                </button>
              ))
            : QUICK_ADD_INR.map((increment) => (
                <button
                  key={increment}
                  type="button"
                  className={styles.quickAddChip}
                  onClick={() => handleQuickAddInr(increment)}
                >
                  +{formatCurrency(increment, 'INR')}
                </button>
              ))}
        </div>

        <div className={styles.summary}>
          {mode === 'inr' ? (
            <>
              <div className={styles.summaryRow}>
                <span>Total Investment Amount (est.):</span>
                <span className={styles.summaryValueBrand}>{formatCurrency(totalInr, 'INR')}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Gold Weight to be Added (est.):</span>
                <span className={styles.summaryValueSuccess}>{grams.toFixed(4)} g</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.summaryRow}>
                <span>Gold Weight to be Added:</span>
                <span className={styles.summaryValueBrand}>{grams.toFixed(4)} g</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Total Investment Amount (est.):</span>
                <span className={styles.summaryValueSuccess}>{formatCurrency(totalInr, 'INR')}</span>
              </div>
            </>
          )}
          <div className={cn(styles.summaryRow, styles.summaryRowMuted)}>
            <span>Base Rate (MCX):</span>
            <span>{formatCurrency(baseAmountInr, 'INR')}</span>
          </div>
          <div className={cn(styles.summaryRow, styles.summaryRowMuted)}>
            <span>Margin (est.):</span>
            <span>{formatCurrency(marginAmountInr, 'INR')}</span>
          </div>
          <div className={cn(styles.summaryRow, styles.summaryRowMuted)}>
            <span>GST (est.):</span>
            <span>{formatCurrency(gstAmountInr, 'INR')}</span>
          </div>
          <p className={styles.summaryDisclaimer}>
            Margin and GST are estimated on the client using the platform default — the
            server applies your tenant&apos;s actual pricing and may differ slightly.
          </p>
        </div>

        {kycBlocked && (
          <p className={styles.statusMessage} data-variant="warning">
            Purchases above {formatCurrency(KYC_GATED_AMOUNT_INR, 'INR')} require KYC verification.
            Complete your KYC to continue.
          </p>
        )}

        {stage === 'polling' && (
          <p className={styles.statusMessage} data-variant="info">
            Payment received — confirming your gold credit…
          </p>
        )}
        {stage === 'timeout' && (
          <p className={styles.statusMessage} data-variant="warning">
            Still processing your payment. This can take a few minutes — check your history shortly.
          </p>
        )}
        {stage === 'cancelled' && (
          <p className={styles.statusMessage} data-variant="danger">
            Payment was not completed.
          </p>
        )}

        <Button
          fullWidth
          disabled={proceedDisabled || (isAuthenticated && kycBlocked)}
          onClick={handleProceed}
        >
          <CoinsIcon width={16} height={16} /> {proceedLabel}
        </Button>
      </Card>
    </section>
  );
}
