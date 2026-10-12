import { formatMobileNumber } from './formatMobileNumber';

describe('formatMobileNumber', () => {
  it('splits a 10-digit number into 5+5 groups', () => {
    expect(formatMobileNumber('9876543210')).toBe('98765 43210');
  });

  it('returns the input unchanged if it is not 10 digits', () => {
    expect(formatMobileNumber('12345')).toBe('12345');
  });
});
