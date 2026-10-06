import { z } from 'zod';
import { GRAMS_DECIMALS, floorGrams } from './redemption.utils';

const GRAMS_PATTERN = new RegExp(`^\\d+(\\.\\d{1,${GRAMS_DECIMALS}})?$`);

// MainServer only rejects non-positive weights and overdraws, so the other rules (format,
// decimals, available balance) live here to catch mistakes before a real debit happens.
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
      .refine((value) => Number(value) > 0, 'Weight must be greater than 0')
      .refine(
        (value) => Number(value) <= maxGrams,
        `You can redeem up to ${maxGrams.toFixed(GRAMS_DECIMALS)} g`,
      ),
  });
}

export type RedemptionFormValues = z.infer<
  ReturnType<typeof createRedemptionSchema>
>;
