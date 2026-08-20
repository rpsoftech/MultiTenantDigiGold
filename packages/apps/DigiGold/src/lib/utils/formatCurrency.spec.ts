import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('formats an INR amount with the ₹ symbol and Indian digit grouping', () => {
    expect(formatCurrency(145000, 'INR')).toBe('₹1,45,000');
  });

  it('rounds to whole units with no decimal places', () => {
    expect(formatCurrency(85500.75, 'INR')).toBe('₹85,501');
  });
});
