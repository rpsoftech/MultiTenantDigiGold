import { createRedemptionSchema } from './redemption.schema';
import { floorGrams } from './redemption.utils';

const schema = createRedemptionSchema(2.5);

describe('createRedemptionSchema', () => {
  it.each(['0.5', '2', '2.5', '1.2345'])('accepts %p', (grams) => {
    expect(schema.safeParse({ grams }).success).toBe(true);
  });

  it.each(['', '0', '0.0000', '-1', 'abc', '1.23456', '2.5001', '3'])(
    'rejects %p',
    (grams) => {
      expect(schema.safeParse({ grams }).success).toBe(false);
    },
  );

  it('never allows more than the floored balance', () => {
    const tight = createRedemptionSchema(1.23459);
    expect(tight.safeParse({ grams: '1.2345' }).success).toBe(true);
    expect(tight.safeParse({ grams: '1.2346' }).success).toBe(false);
  });
});

describe('floorGrams', () => {
  it('rounds down to 4 decimals', () => {
    expect(floorGrams(1.23459)).toBe(1.2345);
    expect(floorGrams(2)).toBe(2);
    expect(floorGrams(0)).toBe(0);
  });
});
