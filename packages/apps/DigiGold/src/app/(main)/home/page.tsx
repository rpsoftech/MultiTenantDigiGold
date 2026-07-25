import { DashboardEssentials } from '@/components/dashboard/DashboardEssentials/DashboardEssentials';
import { TrendingJewelry } from '@/components/dashboard/TrendingJewelry/TrendingJewelry';

export default function HomePage() {
  return (
    <>
      <DashboardEssentials />
      <TrendingJewelry />
    </>
  );
}
