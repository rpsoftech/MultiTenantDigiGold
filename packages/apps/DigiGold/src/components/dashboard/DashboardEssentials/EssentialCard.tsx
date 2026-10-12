import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import type { EssentialItem } from './DashboardEssentials.types';
import { ICON_REGISTRY } from './iconRegistry';
import styles from './DashboardEssentials.module.scss';

export function EssentialCard({ item }: { item: EssentialItem }) {
  const Icon = ICON_REGISTRY[item.icon];

  return (
    <Link href={item.url} className={styles.cardLink}>
      <Card className={styles.card}>
        <span className={styles.iconWrap}>
          <Icon width={20} height={20} />
        </span>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.description}>{item.description}</span>
      </Card>
    </Link>
  );
}
