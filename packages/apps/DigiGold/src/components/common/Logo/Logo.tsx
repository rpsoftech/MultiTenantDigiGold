'use client';

import Image from 'next/image';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { cn } from '@/lib/utils/cn';
import styles from './Logo.module.scss';

export type LogoProps = {
  className?: string;
  height?: number;
};

export function Logo({ className, height = 28 }: LogoProps) {
  const tenantConfig = useTenantConfig();
  const brandName = tenantConfig?.displayName ?? 'DigiGold';

  if (!tenantConfig?.brandLogo?.url) {
    return <span className={cn(styles.textFallback, className)}>{brandName}</span>;
  }

  return (
    <Image
      src={tenantConfig.brandLogo.url}
      alt={tenantConfig.brandLogo.alt || brandName}
      width={168}
      height={32}
      className={cn(styles.image, className)}
      style={{ height, width: 'auto' }}
      priority
    />
  );
}
