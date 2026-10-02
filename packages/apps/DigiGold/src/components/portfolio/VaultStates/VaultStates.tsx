'use client';

import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Loader, Skeleton } from '@/components/common/Loader/Loader';
import { InfoIcon, LockIcon } from '@/components/common/icons/Icons';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';
import styles from './VaultStates.module.scss';

// Skeletons mirror the loaded card's real geometry (valuation block + rate rows) so the
// layout doesn't jump when data lands, and are aria-hidden — the live region below carries
// the actual status.
export function VaultLoadingState() {
  return (
    <div className={styles.loadingGrid}>
      <Card className={styles.skeletonCard}>
        {/* The inner Loader already carries role="status" + the label; adding it here too
            would announce the same load twice. */}
        <span className={styles.statusLine}>
          <Loader size="sm" label="Loading your vault" />
          Loading your vault
        </span>
        <Skeleton width="40%" height="0.8125rem" />
        <Skeleton width="70%" height="2.25rem" />
        <Skeleton width="45%" height="1.125rem" />
        <Skeleton width="100%" height="1px" />
        <Skeleton width="60%" height="2.5rem" rounded />
      </Card>

      <Card className={styles.skeletonCard}>
        <Skeleton width="45%" height="1rem" />
        <div className={styles.skeletonRateList}>
          <Skeleton width="100%" height="1.25rem" />
          <Skeleton width="100%" height="1.25rem" />
          <Skeleton width="100%" height="0.875rem" />
        </div>
      </Card>
    </div>
  );
}

export function VaultUnauthenticatedState({
  onSignIn,
}: {
  onSignIn: () => void;
}) {
  return (
    <Card className={styles.stateCard}>
      <span className={styles.stateIcon} aria-hidden>
        <LockIcon width={22} height={22} />
      </span>
      <h3 className={styles.stateTitle}>Your vault is private</h3>
      <p className={styles.stateBody}>
        Sign in with your registered mobile number to see your gold holdings,
        live valuation and passbook.
      </p>
      <Button onClick={onSignIn}>Sign in to view your vault</Button>
      <p className={styles.stateFootnote}>
        New to DigiGold? Verify your number and start buying in under two
        minutes.
      </p>
    </Card>
  );
}

export function VaultErrorState({
  message,
  onRetry,
  isRetrying,
}: {
  message: string | null;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <Card className={styles.stateCard}>
      <span
        className={cn(styles.stateIcon, styles.stateIconDanger)}
        aria-hidden
      >
        <InfoIcon width={22} height={22} />
      </span>
      <h3 className={styles.stateTitle}>We couldn't load your vault</h3>
      <p className={styles.stateBody}>
        {message ??
          'Something went wrong while fetching your portfolio. Please try again.'}
      </p>
      <Button variant="outlined" onClick={onRetry} isLoading={isRetrying}>
        Try again
      </Button>
      <p className={styles.stateFootnote}>
        Still stuck?{' '}
        <a href={ROUTES.contactSupport} className={styles.stateLink}>
          Contact support
        </a>
      </p>
    </Card>
  );
}
