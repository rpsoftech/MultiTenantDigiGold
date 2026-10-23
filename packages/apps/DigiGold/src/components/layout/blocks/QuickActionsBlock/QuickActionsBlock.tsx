'use client';

import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import { CoinsIcon, TruckIcon } from '@/components/common/icons/Icons';
import essentialStyles from '@/components/dashboard/DashboardEssentials/DashboardEssentials.module.scss';
import type { QuickActionsProps } from '@/features/layout/layout.props';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { ROUTES } from '@/lib/constants/routes';
import type { BlockContext } from '../../layout.registry';
import { useBuyAction } from '../../useBuyAction';
import styles from './QuickActionsBlock.module.scss';

type QuickActionsBlockProps = { props: QuickActionsProps; context: BlockContext };

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

// Same card as the "Your gold, your way" section (icon, title, description), so quick
// actions and essentials read as one family.
function ActionCard({
  Icon,
  title,
  description,
}: {
  Icon: Icon;
  title: string;
  description: string;
}) {
  return (
    <Card className={essentialStyles.card}>
      <span className={essentialStyles.iconWrap}>
        <Icon width={20} height={20} />
      </span>
      <span className={essentialStyles.title}>{title}</span>
      <span className={essentialStyles.description}>{description}</span>
    </Card>
  );
}

// Only actions with a working screen are offered; Sell and SIP join once those exist.
export function QuickActionsBlock({ props }: QuickActionsBlockProps) {
  const modules = useTenantConfig()?.activeModules;
  const { canBuy, startBuy, buyDialog } = useBuyAction();
  const showDelivery = props.showDelivery && (modules?.vault ?? true);

  if (!canBuy && !showDelivery) return null;

  return (
    <nav aria-label="Quick actions">
      <ul className={`${essentialStyles.grid} ${styles.list}`}>
        {canBuy && (
          <li className={styles.item}>
            <button type="button" className={styles.action} onClick={startBuy}>
              <ActionCard
                Icon={CoinsIcon}
                title="Buy gold"
                description="Buy 24K gold at the live rate."
              />
            </button>
          </li>
        )}
        {showDelivery && (
          <li className={styles.item}>
            <Link href={ROUTES.redemptions} className={essentialStyles.cardLink}>
              <ActionCard
                Icon={TruckIcon}
                title="Delivery"
                description="Redeem your gold as coins."
              />
            </Link>
          </li>
        )}
      </ul>
      {buyDialog}
    </nav>
  );
}
