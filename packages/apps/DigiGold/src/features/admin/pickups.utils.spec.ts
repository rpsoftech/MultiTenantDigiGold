import { describe, expect, it } from '@jest/globals';
import {
  isValidPickupCode,
  normalizePhoneSearch,
  sanitizePickupCode,
} from './pickups.utils';

describe('sanitizePickupCode', () => {
  it.each([
    ['482915', '482915'],
    ['482 915', '482915'],
    ['482-915', '482915'],
    [' 4a8b2c9d1e5 ', '482915'],
    ['4829151234', '482915'],
    ['abc', ''],
    ['', ''],
  ])('turns %p into %p', (raw, expected) => {
    expect(sanitizePickupCode(raw)).toBe(expected);
  });
});

describe('isValidPickupCode', () => {
  it.each(['000000', '482915'])('accepts %p', (code) => {
    expect(isValidPickupCode(code)).toBe(true);
  });

  it.each(['', '12345', '1234567', '12345a', '12 345'])(
    'rejects %p',
    (code) => {
      expect(isValidPickupCode(code)).toBe(false);
    },
  );
});

describe('normalizePhoneSearch', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['98765 43210', '9876543210'],
    ['98765-43210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['  (987) 654-3210 ', '9876543210'],
  ])('normalises %p', (raw, expected) => {
    expect(normalizePhoneSearch(raw)).toBe(expected);
  });

  it.each(['', '12345', '98765432', '98765432101', '+1 9876543210', 'abc'])(
    'returns null for %p',
    (raw) => {
      expect(normalizePhoneSearch(raw)).toBeNull();
    },
  );
});
