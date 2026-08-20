// Display-only formatting — symbol and digit grouping come from Intl for the given
// currency/locale rather than a hardcoded "₹" or thousands separator.
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
