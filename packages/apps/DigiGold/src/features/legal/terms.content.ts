import { BUSINESS_DETAILS } from './businessDetails';
import type { LegalContent } from './legal.types';

export const SEBI_DIGITAL_GOLD_NOTICE_URL =
  'https://www.sebi.gov.in/media-and-notifications/press-releases/nov-2025/caution-to-public-regarding-dealing-in-digital-gold-_97676.html';

export const TERMS_OF_SERVICE: LegalContent = {
  title: 'Terms of Service',
  effectiveDate: '[Effective Date]',
  lastUpdated: '[Last Updated Date]',
  sections: [
    {
      id: 'about',
      heading: 'About these terms',
      blocks: [
        {
          kind: 'paragraph',
          text: 'These Terms of Service govern your use of [Store Name] through the DigiGold application.',
        },
        {
          kind: 'paragraph',
          text: 'Gold purchases and physical redemption services on this storefront are provided by [Jeweller Legal Name] (the Jeweller). The application technology is provided by [Platform Operator Legal Name].',
        },
        {
          kind: 'paragraph',
          text: 'Please read these terms before creating an account or completing a transaction. Our Privacy Policy explains how personal information is handled.',
        },
      ],
    },
    {
      id: 'eligibility',
      heading: 'Eligibility and account security',
      blocks: [
        {
          kind: 'paragraph',
          text: 'You must be at least 18 years old and legally capable of entering into a contract to transact through this application.',
        },
        {
          kind: 'paragraph',
          text: 'Provide accurate registration and verification information and keep your mobile number current. Protect your device and login OTPs. Notify [Support Email] promptly if you suspect unauthorised access.',
        },
      ],
    },
    {
      id: 'identity-verification',
      heading: 'Identity verification',
      blocks: [
        {
          kind: 'paragraph',
          text: 'We may require identity verification before allowing certain transactions or account activities. The current KYC process requests your PAN and the last four digits of your Aadhaar number.',
        },
        {
          kind: 'paragraph',
          text: 'Verification requirements and transaction limits will be communicated through the application. Transactions may be restricted while verification is incomplete or under review.',
        },
      ],
    },
    {
      id: 'prices-and-charges',
      heading: 'Gold prices taxes and charges',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Gold prices fluctuate. Prices displayed while browsing may change before an order is confirmed.',
        },
        {
          kind: 'paragraph',
          text: 'Review the final quoted price, gold weight, applicable taxes, margins and other charges before paying. A price quote is valid only until its displayed expiry time. An expired quote requires a new quotation.',
        },
        {
          kind: 'paragraph',
          text: 'The confirmed transaction record identifies the amount paid and the gold weight credited to your account.',
        },
      ],
    },
    {
      id: 'payments',
      heading: 'Payments and confirmation',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Online payments are processed through the payment provider identified at checkout, including Razorpay where enabled.',
        },
        {
          kind: 'paragraph',
          text: 'A payment acknowledgement does not by itself confirm that gold has been credited. The purchase is complete when payment verification and the corresponding account entry are confirmed.',
        },
        {
          kind: 'paragraph',
          text: 'If money is debited but your purchase remains pending, contact [Support Email] with your order and payment references before attempting another payment.',
        },
      ],
    },
    {
      id: 'ownership-custody',
      heading: 'Gold ownership custody and storage',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Your digital vault displays the gold balance recorded against your account with the Jeweller. The arrangements applying to your purchases are:',
        },
        {
          kind: 'list',
          items: [
            { label: 'Gold supplier', text: '[Legal Name].' },
            { label: 'Purity', text: '[Verified Purity or Fineness].' },
            {
              label: 'Ownership and allocation',
              text: '[When ownership transfers and whether holdings are individually allocated or pooled].',
            },
            {
              label: 'Custodian and storage',
              text: '[Responsible Entity and Storage Arrangement].',
            },
            {
              label: 'Storage period and charges',
              text: '[Storage Terms].',
            },
            {
              label: 'Insurance',
              text: '[Verified Coverage, Insurer, Limits and Exclusions, or Clear Disclosure That Coverage Is Not Provided].',
            },
            {
              label: 'Provider failure or service closure',
              text: '[How Customers Can Recover or Redeem Their Holdings].',
            },
          ],
        },
      ],
    },
    {
      id: 'redemption',
      heading: 'Physical redemption',
      blocks: [
        {
          kind: 'paragraph',
          text: 'You may request physical redemption against your available gold balance through the application. The requested weight is deducted when the redemption request is created.',
        },
        {
          kind: 'paragraph',
          text: 'Collection takes place at [Store or Collection Location], subject to [Minimum Weight, Available Products, Collection Timeframe and Applicable Charges].',
        },
        {
          kind: 'paragraph',
          text: 'Keep your pickup code confidential and provide it to authorised store staff when completing collection.',
        },
        {
          kind: 'paragraph',
          text: 'A pending redemption may be cancelled through the available cancellation process. Once cancellation is confirmed, the corresponding gold weight is restored to your vault. Completed collections cannot be cancelled through the application; applicable rights concerning defective or incorrectly supplied goods remain available.',
        },
      ],
    },
    {
      id: 'cancellations-refunds',
      heading: 'Cancellations failed payments and refunds',
      blocks: [
        {
          kind: 'paragraph',
          text: 'For confirmed gold purchases, cancellation eligibility and any applicable charges are: [Purchase Cancellation Policy].',
        },
        {
          kind: 'paragraph',
          text: 'Failed, duplicate or expired-quote payments will be investigated and reconciled. Where a refund is due, it will ordinarily be returned to the original payment method within [Refund Timeframe], subject to applicable legal requirements.',
        },
        {
          kind: 'paragraph',
          text: 'Cancelling a pending redemption restores gold weight and does not itself create a cash refund.',
        },
        {
          kind: 'paragraph',
          text: 'For assistance, contact [Support Email] with your transaction reference.',
        },
      ],
    },
    {
      id: 'risks',
      heading: 'Risks and service availability',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Gold prices can fall as well as rise. We do not promise interest, income or a guaranteed return.',
        },
        {
          kind: 'paragraph',
          text: 'Digital gold products carry market, counterparty and operational risks. SEBI has stated that digital gold products fall outside its regulatory framework and do not receive securities-market investor protections.',
        },
        {
          kind: 'paragraph',
          text: 'Maintenance, connectivity problems or payment-provider interruptions may temporarily affect access. Contact support if an interruption affects a transaction or redemption.',
        },
        {
          kind: 'link',
          label: 'Read SEBI digital gold notice',
          href: SEBI_DIGITAL_GOLD_NOTICE_URL,
        },
      ],
    },
    {
      id: 'restrictions-closure',
      heading: 'Restrictions and account closure',
      blocks: [
        {
          kind: 'paragraph',
          text: 'You must not use the application for fraud, unlawful transactions, impersonation or attempts to bypass security controls.',
        },
        {
          kind: 'paragraph',
          text: 'We may restrict access where reasonably necessary to investigate suspected misuse, protect accounts or comply with law. Where permitted, we will explain the restriction and the available resolution process.',
        },
        {
          kind: 'paragraph',
          text: 'To close your account, contact [Support Email]. Outstanding payments, redemption requests and gold holdings must be resolved through the applicable process. Account closure does not automatically forfeit your holdings.',
        },
      ],
    },
    {
      id: 'complaints',
      heading: 'Complaints and applicable law',
      blocks: [
        {
          kind: 'paragraph',
          text: 'These terms are governed by Indian law. Nothing in these terms limits consumer rights or liabilities that cannot lawfully be excluded.',
        },
        {
          kind: 'paragraph',
          text: 'Send complaints to the grievance officer listed in our business details. Consumer complaints will be acknowledged within 48 hours and addressed within one month, consistent with the applicable Consumer Protection (E-Commerce) Rules.',
        },
        {
          kind: 'paragraph',
          text: 'You retain the right to approach a competent consumer commission, court or other statutory authority.',
        },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to these terms',
      blocks: [
        {
          kind: 'paragraph',
          text: 'We may update these terms to reflect changes to services or legal requirements. Updated terms will display a revised date, and material changes will be communicated through an appropriate channel. Changes will not retrospectively alter completed transactions except where required by law.',
        },
      ],
    },
    {
      id: 'business-details',
      heading: 'Business details',
      blocks: [BUSINESS_DETAILS],
    },
  ],
};
