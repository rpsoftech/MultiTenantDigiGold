'use client';

import { PromoCarousel } from '@/components/dashboard/PromoCarousel/PromoCarousel';
import { CategoryCarousel } from '@/components/dashboard/CategoryCarousel/CategoryCarousel';
import { DashboardEssentials } from '@/components/dashboard/DashboardEssentials/DashboardEssentials';
import { TrendingJewelry } from '@/components/dashboard/TrendingJewelry/TrendingJewelry';
import { BuyGold } from '@/components/dashboard/BuyGold/BuyGold';
import { Loader, Skeleton } from '@/components/common/Loader/Loader';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useAppSelector } from '@/store/hooks';
import { selectLayoutStatus } from '@/store/tenant/tenant.slice';
import { hasRenderableBlock, LayoutRenderer } from '../LayoutRenderer';
import { SectionBand } from '../SectionBand/SectionBand';
import styles from './HomeContent.module.scss';

// The standard storefront, used by a tenant that has not published a layout (or whose
// published layout has nothing this build can draw) so the home page is never blank.
function DefaultHome() {
  return (
    <>
      <SectionBand index={0}>
        <PromoCarousel />
      </SectionBand>
      <SectionBand index={1}>
        <CategoryCarousel />
      </SectionBand>
      <SectionBand index={2}>
        <DashboardEssentials />
      </SectionBand>
      <SectionBand index={3}>
        <TrendingJewelry />
      </SectionBand>
      <SectionBand index={4}>
        <BuyGold />
      </SectionBand>
    </>
  );
}

function LayoutLoading() {
  return (
    <div className={styles.loading}>
      <Loader label="Loading your store" />
      <Skeleton width="100%" height="10rem" rounded />
      <Skeleton width="100%" height="6rem" rounded />
    </div>
  );
}

export function HomeContent() {
  const status = useAppSelector(selectLayoutStatus);
  const layout = useTenantConfig()?.layout ?? [];

  if (status === 'loading') return <LayoutLoading />;
  if (status === 'ready' && hasRenderableBlock(layout)) return <LayoutRenderer blocks={layout} />;
  return <DefaultHome />;
}
