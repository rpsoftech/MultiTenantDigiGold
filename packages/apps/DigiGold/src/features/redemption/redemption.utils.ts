import type { BadgeVariant } from '@/components/common/Badge/Badge';
import type { RedemptionStatus } from './redemption.types';

// MainServer rounds redemption weights to 4 decimals.
export const GRAMS_DECIMALS = 4;

export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  PENDING: 'Pending',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
};

export const REDEMPTION_STATUS_VARIANTS: Record<
  RedemptionStatus,
  BadgeVariant
> = {
  PENDING: 'brand',
  COLLECTED: 'success',
  CANCELLED: 'danger',
};

export function formatGrams(grams: number): string {
  return `${grams.toFixed(GRAMS_DECIMALS)} g`;
}

// Rounds down so "Max" never asks for more than the vault actually holds.
export function floorGrams(grams: number): number {
  const factor = 10 ** GRAMS_DECIMALS;
  return Math.floor(grams * factor + 1e-9) / factor;
}
