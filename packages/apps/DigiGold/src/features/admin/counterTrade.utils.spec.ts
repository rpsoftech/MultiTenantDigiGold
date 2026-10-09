import { describe, expect, it } from '@jest/globals';
import { decimalPlaces, sizeCounterTrade } from './counterTrade.utils';

describe('sizeCounterTrade', () => {
  it('sizes an amount into grams rounded to 4 places', () => {
    expect(sizeCounterTrade(7000, { amountInr: 1000 })).toEqual({
      weightGrams: 0.1429,
      amountInr: 1000,
    });
  });

  it('sizes grams into an amount rounded to 2 places', () => {
    expect(sizeCounterTrade(7234.56, { weightGrams: 1.5 })).toEqual({
      weightGrams: 1.5,
      amountInr: 10851.84,
    });
  });

  it('prefers grams when both are given, like MainServer', () => {
    expect(sizeCounterTrade(7000, { weightGrams: 1, amountInr: 99999 })).toEqual({
      weightGrams: 1,
      amountInr: 7000,
    });
  });

  it('rejects a missing, zero or negative size', () => {
    expect(sizeCounterTrade(7000, {})).toBeNull();
    expect(sizeCounterTrade(7000, { amountInr: 0 })).toBeNull();
    expect(sizeCounterTrade(7000, { weightGrams: -1 })).toBeNull();
  });

  it('rejects an amount that rounds to zero grams', () => {
    expect(sizeCounterTrade(7000, { amountInr: 0.01 })).toBeNull();
  });

  it('rejects an unusable rate', () => {
    expect(sizeCounterTrade(0, { amountInr: 100 })).toBeNull();
    expect(sizeCounterTrade(Number.NaN, { amountInr: 100 })).toBeNull();
  });
});

describe('decimalPlaces', () => {
  it('counts typed decimals', () => {
    expect(decimalPlaces('12')).toBe(0);
    expect(decimalPlaces('12.5')).toBe(1);
    expect(decimalPlaces('0.12345')).toBe(5);
  });
});
