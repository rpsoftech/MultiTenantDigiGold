import type { TenantConfig } from '@/features/tenant/tenant.types';

export type PromoSlide = {
  id: string;
  imageUrl: string;
  imageAlt: string;
  linkUrl?: string;
  // Hidden when the tenant (or this build) has this module switched off.
  module?: keyof TenantConfig['activeModules'];
  enabled: boolean;
  order: number;
};

export type PromoCarouselConfig = {
  autoplayIntervalMs: number;
  slides: PromoSlide[];
};
