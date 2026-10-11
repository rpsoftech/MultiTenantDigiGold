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

// Income Tax Act s.269ST: MainServer refuses cash that would take a customer's cash paid
// at the counter today to this amount or more.
export const COUNTER_CASH_LIMIT_INR = 200000;

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
