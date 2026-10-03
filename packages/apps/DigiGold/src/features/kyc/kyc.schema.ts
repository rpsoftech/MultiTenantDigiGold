import { z } from 'zod';

// MainServer performs no validation on POST /user/kyc, so every rule lives here.
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const kycSchema = z.object({
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_PATTERN, 'Enter a valid PAN, e.g. ABCDE1234F'),
  aadhaarLast4: z.string().trim().regex(/^\d{4}$/, 'Enter the last 4 digits of your Aadhaar'),
  documentUrl: z
    .string()
    .trim()
    .refine(
      (value) => {
        if (value === '') return true;
        try {
          return new URL(value).protocol === 'https:';
        } catch {
          return false;
        }
      },
      'Enter a valid https:// link',
    ),
});

export type KycFormValues = z.infer<typeof kycSchema>;
