'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';
import styles from './BuySellGold.module.scss';

const GST_RATE = 0.03;
const PRICE_LOCK_SECONDS = 60;
const QUICK_ADD_GRAMS = [0.5, 1, 5, 10];
const QUICK_ADD_INR = [1000, 5000, 10000, 25000];
const NUMERIC_INPUT_PATTERN = /^\d*\.?\d*$/;

type BuyMode = 'grams' | 'inr';

export function BuySellGold() {
  const router = useRouter();
  const tenantConfig = useTenantConfig();
  const { showToast } = useToast();
  const { isAuthenticated } = useSession();
  const { data: rate, isLoading } = useLiveRate();

  const [mode, setMode] = useState<BuyMode>('grams');
  const [gramsInput, setGramsInput] = useState('1');
  const [lockKey, setLockKey] = useState(0);

  if (tenantConfig && !tenantConfig.activeModules.trading) return null;

  const pricePerGram = rate?.pricePerGramInr ?? 0;
  const grams = Number(gramsInput) || 0;
  const totalInr = grams * pricePerGram;
  const gstAmount = totalInr - totalInr / (1 + GST_RATE);
  const inrInputValue = totalInr ? totalInr.toFixed(2) : '';

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

  const handleProceed = () => {
    if (!isAuthenticated) {
      router.push(ROUTES.login);
      return;
    }
    showToast({
      variant: 'success',
      title: 'Order queued',
      description: `Buying ${grams.toFixed(4)}g for ${formatCurrency(totalInr, 'INR')}.`,
    });
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Buy / Sell Gold</h2>

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

          <div className={styles.priceLock}>
            <span className={styles.priceLockLabel}>
              <ClockIcon width={12} height={12} /> Price Locked
            </span>
            <CountdownTimer
              key={lockKey}
              seconds={PRICE_LOCK_SECONDS}
              onExpire={() => setLockKey((key) => key + 1)}
              className={styles.priceLockTimer}
            />
          </div>
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
                <span>Total Investment Amount:</span>
                <span className={styles.summaryValueBrand}>{formatCurrency(totalInr, 'INR')}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Gold Weight to be Added:</span>
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
                <span>Total Investment Amount:</span>
                <span className={styles.summaryValueSuccess}>{formatCurrency(totalInr, 'INR')}</span>
              </div>
            </>
          )}
          <div className={cn(styles.summaryRow, styles.summaryRowMuted)}>
            <span>Applicable GST (3% included):</span>
            <span>{formatCurrency(gstAmount, 'INR')}</span>
          </div>
        </div>

        <Button fullWidth disabled={grams <= 0 || isLoading} onClick={handleProceed}>
          <CoinsIcon width={16} height={16} />{' '}
          {isAuthenticated
            ? `Proceed to Pay ${formatCurrency(totalInr, 'INR')}`
            : 'Login to Proceed'}
        </Button>
      </Card>
    </section>
  );
}
