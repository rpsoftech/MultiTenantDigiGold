import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument/LegalDocument';
import { PRIVACY_POLICY } from '@/features/legal/privacy.content';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPolicyPage() {
  return <LegalDocument content={PRIVACY_POLICY} />;
}
