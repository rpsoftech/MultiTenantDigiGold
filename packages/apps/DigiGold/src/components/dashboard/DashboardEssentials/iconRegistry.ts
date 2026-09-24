import type { ComponentType, SVGProps } from 'react';
import { CoinsIcon, GemIcon, WalletIcon } from '@/components/common/icons/Icons';
import type { EssentialIconKey } from './DashboardEssentials.types';

export const ICON_REGISTRY: Record<EssentialIconKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  wallet: WalletIcon,
  coins: CoinsIcon,
  gem: GemIcon,
};
