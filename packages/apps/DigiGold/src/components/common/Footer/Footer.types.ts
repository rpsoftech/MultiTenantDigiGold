import type { IconKey } from '@/components/common/icons/iconRegistry';

export type FooterLinkTarget = '_self' | '_blank';

export type FooterLink = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  order: number;
  icon?: IconKey;
  target?: FooterLinkTarget;
};

export type FooterColumn = {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  links: FooterLink[];
};

export type FooterConfig = {
  columns: FooterColumn[];
};
