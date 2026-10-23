import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument/LegalDocument';
import { TERMS_OF_SERVICE } from '@/features/legal/terms.content';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsOfServicePage() {
  return <LegalDocument content={TERMS_OF_SERVICE} />;
}
