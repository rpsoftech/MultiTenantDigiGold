export type PromoSlide = {
  id: string;
  imageUrl: string;
  imageAlt: string;
  linkUrl?: string;
  enabled: boolean;
  order: number;
};

export type PromoCarouselConfig = {
  autoplayIntervalMs: number;
  slides: PromoSlide[];
};
