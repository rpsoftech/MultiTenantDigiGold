import type { ComponentType, SVGProps } from 'react';
import { ArrowRightIcon, HomeIcon, LockIcon, ShieldIcon, UserIcon } from './Icons';

export type IconKey = 'home' | 'lock' | 'user' | 'shield' | 'arrow-right';

export const ICON_REGISTRY: Record<IconKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  home: HomeIcon,
  lock: LockIcon,
  user: UserIcon,
  shield: ShieldIcon,
  'arrow-right': ArrowRightIcon,
};
