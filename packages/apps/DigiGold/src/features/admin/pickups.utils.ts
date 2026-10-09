export const PICKUP_CODE_LENGTH = 6;
export const PHONE_LENGTH = 10;

// The code is read out by the customer, so tolerate pasted spaces or dashes ("482 915").
export function sanitizePickupCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PICKUP_CODE_LENGTH);
}

export function isValidPickupCode(code: string): boolean {
  return new RegExp(`^\\d{${PICKUP_CODE_LENGTH}}$`).test(code);
}

// MainServer matches the stored 10-digit number exactly. Accept the forms a counter is likely
// to paste ("+91 98765-43210", "098765 43210") and reduce them to that; null when it is not
// a 10-digit mobile number.
export function normalizePhoneSearch(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === PHONE_LENGTH + 2 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === PHONE_LENGTH + 1 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.length === PHONE_LENGTH ? digits : null;
}
