// Display-only formatting — symbol and digit grouping come from Intl for the given
// currency/locale rather than a hardcoded "₹" or thousands separator.
//
// Whole units are the default because most surfaces here show portfolio-scale totals. Pass
// fractionDigits where the paise matter — a bid/ask spread is a few rupees on a ~₹7,000 rate,
// and rounding both sides to 0dp collapses a real spread to "₹0".
export function formatCurrency(
  amount: number,
  currency: string,
  fractionDigits = 0,
): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
