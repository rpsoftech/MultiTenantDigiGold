import { PromoCarousel } from '@/components/dashboard/PromoCarousel/PromoCarousel';
import { CategoryCarousel } from '@/components/dashboard/CategoryCarousel/CategoryCarousel';
import { DashboardEssentials } from '@/components/dashboard/DashboardEssentials/DashboardEssentials';
import { TrendingJewelry } from '@/components/dashboard/TrendingJewelry/TrendingJewelry';
import { BuyGold } from '@/components/dashboard/BuyGold/BuyGold';

export default function HomePage() {
  return (
    <>
      <PromoCarousel />
      <CategoryCarousel />
      <DashboardEssentials />
      <TrendingJewelry />
      <BuyGold />
    </>
  );
}
