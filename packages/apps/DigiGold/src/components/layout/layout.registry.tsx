import type { ReactNode } from 'react';
import {
  parseHeroProps,
  parseNoProps,
  parseQuickActionsProps,
} from '@/features/layout/layout.props';
import {
  parseCategoryCarouselProps,
  parseDashboardEssentialsProps,
  parsePromoCarouselProps,
  parseTrendingJewelryProps,
} from '@/features/layout/layout.sections';
import { BuyGold } from '@/components/dashboard/BuyGold/BuyGold';
import { CategoryCarousel } from '@/components/dashboard/CategoryCarousel/CategoryCarousel';
import { DashboardEssentials } from '@/components/dashboard/DashboardEssentials/DashboardEssentials';
import { PromoCarousel } from '@/components/dashboard/PromoCarousel/PromoCarousel';
import { TrendingJewelry } from '@/components/dashboard/TrendingJewelry/TrendingJewelry';
import { HeroBlock } from './blocks/HeroBlock/HeroBlock';
import { LiveRateBlock } from './blocks/LiveRateBlock/LiveRateBlock';
import { PortfolioSummaryBlock } from './blocks/PortfolioSummaryBlock/PortfolioSummaryBlock';
import { QuickActionsBlock } from './blocks/QuickActionsBlock/QuickActionsBlock';

export type BlockContext = {
  // True for the first block of its type on the page; the hero uses it to be the only h1.
  isFirstOfType: boolean;
};

type BlockDefinition = {
  // False for a block that only configures something else, so a layout made of nothing
  // else still counts as empty.
  drawsContent: boolean;
  // The dashboard sections carry their own page padding, so the slot must not add more.
  fullBleed: boolean;
  render: (rawProps: Record<string, unknown>, context: BlockContext) => ReactNode;
};

// Pairs a block's prop parser with its component so the parsed shape is checked at the
// definition, then erases the prop type for storage in the registry.
function defineBlock<Props>(
  parseProps: (raw: Record<string, unknown>) => Props,
  Component: (props: { props: Props; context: BlockContext }) => ReactNode,
  options: { fullBleed?: boolean } = {}
): BlockDefinition {
  return {
    fullBleed: options.fullBleed ?? false,
    drawsContent: true,
    render: (raw, context) => <Component props={parseProps(raw)} context={context} />,
  };
}

// Keyed by `${type}_${variant}`, the same keys the admin builder publishes. Adding a block
// means adding one entry here.
export const BLOCK_REGISTRY: Record<string, BlockDefinition> = {
  // The shell already renders the header and its navigation; this block only brands it
  // (see features/layout/headerOverride.ts), so it draws nothing in the page body.
  Header_1: { drawsContent: false, fullBleed: false, render: () => null },
  Hero_1: defineBlock(parseHeroProps, HeroBlock),
  LiveRate_1: defineBlock(parseNoProps, LiveRateBlock),
  QuickActions_1: defineBlock(parseQuickActionsProps, QuickActionsBlock),
  PortfolioSummary_1: defineBlock(parseNoProps, PortfolioSummaryBlock),
  // The dashboard sections. Their content comes from the block props when the tenant
  // publishes it, and from the frontend config otherwise.
  PromoCarousel_1: defineBlock(parsePromoCarouselProps, ({ props }) => <PromoCarousel {...props} />, {
    fullBleed: true,
  }),
  CategoryCarousel_1: defineBlock(
    parseCategoryCarouselProps,
    ({ props }) => <CategoryCarousel {...props} />,
    { fullBleed: true }
  ),
  DashboardEssentials_1: defineBlock(
    parseDashboardEssentialsProps,
    ({ props }) => <DashboardEssentials {...props} />,
    { fullBleed: true }
  ),
  TrendingJewelry_1: defineBlock(
    parseTrendingJewelryProps,
    ({ props }) => <TrendingJewelry {...props} />,
    { fullBleed: true }
  ),
  BuyGold_1: defineBlock(parseNoProps, () => <BuyGold />, { fullBleed: true }),
};

export function blockKey(type: string, variant: string): string {
  return `${type}_${variant}`;
}
