import { BuySellGold } from '@/components/dashboard/BuySellGold/BuySellGold';
import { CategoryCarousel } from '@/components/dashboard/CategoryCarousel/CategoryCarousel';
import { DashboardEssentials } from '@/components/dashboard/DashboardEssentials/DashboardEssentials';
import { PromoCarousel } from '@/components/dashboard/PromoCarousel/PromoCarousel';
import { TrendingJewelry } from '@/components/dashboard/TrendingJewelry/TrendingJewelry';

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
