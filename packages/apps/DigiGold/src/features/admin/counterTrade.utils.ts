// Mirrors MainServerGo/internal/service/trade_service.go sizeTrade() so the confirmation
// shows exactly the grams and rupees the server will record. MainServer rounds grams to
// 4 decimals and rupees to 2, and rejects a trade whose grams or rupees round to zero.
export type CounterTradeInput = {
  weightGrams?: number;
  amountInr?: number;
};

export type SizedCounterTrade = {
  weightGrams: number;
  amountInr: number;
};

// MainServer's slippageToleranceINR: a rate further than this from its live price is refused.
export const COUNTER_RATE_TOLERANCE_INR = 30;

export const COUNTER_MAX_GRAMS_DECIMALS = 4;
export const COUNTER_MAX_INR_DECIMALS = 2;

export function sizeCounterTrade(
  ratePerGram: number,
  { weightGrams, amountInr }: CounterTradeInput,
): SizedCounterTrade | null {
  if (!Number.isFinite(ratePerGram) || ratePerGram <= 0) return null;

  let weight: number;
  let total: number;
  if (weightGrams !== undefined && weightGrams > 0) {
    weight = Math.round(weightGrams * 10000) / 10000;
    total = Math.round(weight * ratePerGram * 100) / 100;
  } else if (amountInr !== undefined && amountInr > 0) {
    total = Math.round(amountInr * 100) / 100;
    weight = Math.round((total / ratePerGram) * 10000) / 10000;
  } else {
    return null;
  }
  if (!(weight > 0) || !(total > 0)) return null;
  return { weightGrams: weight, amountInr: total };
}

// Number of decimal places the user typed, for rejecting input the server would round.
export function decimalPlaces(value: string): number {
  const [, fraction = ''] = value.trim().split('.');
  return fraction.length;
}
