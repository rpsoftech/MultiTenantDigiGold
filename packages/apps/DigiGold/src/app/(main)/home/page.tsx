import { PromoCarousel } from '@/components/dashboard/PromoCarousel/PromoCarousel';
import { CategoryCarousel } from '@/components/dashboard/CategoryCarousel/CategoryCarousel';
import { DashboardEssentials } from '@/components/dashboard/DashboardEssentials/DashboardEssentials';
import { TrendingJewelry } from '@/components/dashboard/TrendingJewelry/TrendingJewelry';
import { BuySellGold } from '@/components/dashboard/BuySellGold/BuySellGold';

export default function HomePage() {
  return (
    <>
      <PromoCarousel />
      <CategoryCarousel />
      <DashboardEssentials />
      <TrendingJewelry />
      <BuySellGold />
    </>
  );
}
