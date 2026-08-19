// Display-only formatting ("9876543210" -> "98765 43210") — the underlying value stays
// unformatted everywhere it's sent to the API or held in state.
export function formatMobileNumber(mobileNumber: string): string {
  if (mobileNumber.length !== 10) return mobileNumber;
  return `${mobileNumber.slice(0, 5)} ${mobileNumber.slice(5)}`;
}
