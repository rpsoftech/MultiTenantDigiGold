import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import { ROUTES } from '@/lib/constants/routes';
import styles from './JewelleryUnavailable.module.scss';

// Shown when the jewellery catalogue is off: the tenant's ecommerce module is switched off,
// or the build hides it (NEXT_PUBLIC_ENABLE_JEWELLERY=false in production). The nav and
// the home page already hide jewellery; this covers typed or bookmarked catalogue URLs.
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
