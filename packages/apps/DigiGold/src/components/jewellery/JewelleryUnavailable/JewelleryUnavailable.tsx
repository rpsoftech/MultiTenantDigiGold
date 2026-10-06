import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import { ROUTES } from '@/lib/constants/routes';
import styles from './JewelleryUnavailable.module.scss';

// Shown when the tenant has the ecommerce module switched off. The nav already hides the
// Jewellery link; this covers typed or bookmarked catalogue URLs.
export function JewelleryUnavailable() {
  return (
    <Card className={styles.card}>
      <h1 className={styles.title}>Jewellery isn&apos;t available here</h1>
      <p className={styles.body}>
        This store doesn&apos;t offer the jewellery catalogue right now.
      </p>
      <Link href={ROUTES.home} className={styles.link}>
        Back to home
      </Link>
    </Card>
  );
}
