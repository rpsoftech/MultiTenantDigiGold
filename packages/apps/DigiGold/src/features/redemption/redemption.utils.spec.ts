import {
  REDEMPTION_STATUS_LABELS,
  REDEMPTION_STATUS_VARIANTS,
  formatGrams,
} from './redemption.utils';

describe('redemption utils', () => {
  it('formats grams to four decimals with a unit', () => {
    expect(formatGrams(2)).toBe('2.0000 g');
    expect(formatGrams(0.12345)).toBe('0.1235 g');
  });

  it('labels every status', () => {
    expect(REDEMPTION_STATUS_LABELS).toEqual({
      PENDING: 'Pending',
      COLLECTED: 'Collected',
      CANCELLED: 'Cancelled',
    });
  });

  it('maps statuses to badge variants', () => {
    expect(REDEMPTION_STATUS_VARIANTS).toEqual({
      PENDING: 'brand',
      COLLECTED: 'success',
      CANCELLED: 'danger',
    });
  });
});
