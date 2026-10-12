import { z } from 'zod';
import {
  GRAMS_DECIMALS,
  MIN_REDEMPTION_GRAMS,
  floorGrams,
} from './redemption.utils';

const GRAMS_PATTERN = new RegExp(`^\\d+(\\.\\d{1,${GRAMS_DECIMALS}})?$`);

// MainServer rejects weights below the minimum and overdraws; the format and decimal rules
// live here too, to catch mistakes before a real debit happens.
export function createRedemptionSchema(availableGrams: number) {
  const maxGrams = floorGrams(availableGrams);

  return z.object({
    grams: z
      .string()
      .trim()
      .regex(
        GRAMS_PATTERN,
        `Enter a weight with up to ${GRAMS_DECIMALS} decimal places`,
      )
      .refine(
        (value) => Number(value) >= MIN_REDEMPTION_GRAMS,
        `The minimum redemption is ${MIN_REDEMPTION_GRAMS} g`,
      )
      .refine(
        (value) => Number(value) <= maxGrams,
        `You can redeem up to ${maxGrams.toFixed(GRAMS_DECIMALS)} g`,
      ),
  });
}

export type RedemptionFormValues = z.infer<
  ReturnType<typeof createRedemptionSchema>
>;
