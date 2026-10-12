import { z } from 'zod';

// Mirrors MainServer's validation on POST /user/kyc (panPattern / aadhaarLast4Pattern in
// customer_trade_controller.go), so mistakes are caught before a round-trip.
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const kycSchema = z.object({
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_PATTERN, 'Enter a valid PAN, e.g. ABCDE1234F'),
  aadhaarLast4: z.string().trim().regex(/^\d{4}$/, 'Enter the last 4 digits of your Aadhaar'),
});

export type KycFormValues = z.infer<typeof kycSchema>;
