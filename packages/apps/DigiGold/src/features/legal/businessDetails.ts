import type { LegalBlock } from './legal.types';

// Shared "Business details" block, identical in both documents.
export const BUSINESS_DETAILS: LegalBlock = {
  kind: 'details',
  rows: [
    { label: 'Storefront', value: '[Store Name]' },
    { label: 'Seller', value: '[Jeweller Legal Name]' },
    { label: 'Registered address', value: '[Complete Address, State, PIN, India]' },
    { label: 'Registration details', value: '[GSTIN and CIN or LLPIN, where applicable]' },
    { label: 'Technology provider', value: '[Platform Operator Legal Name and Address]' },
    { label: 'Customer support', value: '[Support Email] and [Support Phone]' },
    { label: 'Privacy contact', value: '[Privacy Contact Email]' },
    {
      label: 'Grievance officer',
      value: '[Name, Designation, Email and Postal Address]',
    },
  ],
};
