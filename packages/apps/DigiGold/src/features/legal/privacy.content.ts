import { BUSINESS_DETAILS } from './businessDetails';
import type { LegalContent } from './legal.types';

export const PRIVACY_POLICY: LegalContent = {
  title: 'Privacy Policy',
  effectiveDate: '[Effective Date]',
  lastUpdated: '[Last Updated Date]',
  sections: [
    {
      id: 'about',
      heading: 'About this policy',
      blocks: [
        {
          kind: 'paragraph',
          text: 'This Privacy Policy explains how [Jeweller Legal Name] and [Platform Operator Legal Name] handle personal information when you use the [Store Name] DigiGold storefront.',
        },
        {
          kind: 'paragraph',
          text: 'The Jeweller manages your customer relationship and transactions. The platform provider supplies the application and supporting technology. Their respective privacy responsibilities are [Privacy Responsibilities of Each Entity]. Their business and contact details appear below.',
        },
      ],
    },
    {
      id: 'information-we-collect',
      heading: 'Information we collect',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Depending on the services you use, we collect:',
        },
        {
          kind: 'list',
          items: [
            {
              label: 'Account information',
              text: 'Mobile number, full name, city or location you provide, and optional email address.',
            },
            {
              label: 'Verification information',
              text: 'PAN, the last four digits of Aadhaar, verification status and related review records. The current KYC form does not request your full Aadhaar number or biometric information.',
            },
            {
              label: 'Transaction information',
              text: 'Orders, payment references and status, amounts, gold weights, vault balances and transaction history.',
            },
            {
              label: 'Redemption information',
              text: 'Requested weight, pickup verification details, collection status and cancellation records.',
            },
            {
              label: 'Support information',
              text: 'Information you provide when contacting us.',
            },
            {
              label: 'Technical information',
              text: 'IP address, session identifiers and operational or security logs generated when you use the service.',
            },
          ],
        },
        {
          kind: 'paragraph',
          text: 'Payment credentials are entered through the payment provider checkout. We receive the references and transaction status needed to process and reconcile your purchase.',
        },
      ],
    },
    {
      id: 'why-we-use',
      heading: 'Why we use this information',
      blocks: [
        { kind: 'paragraph', text: 'We use personal information to:' },
        {
          kind: 'list',
          items: [
            { text: 'Register your account and authenticate access using OTPs.' },
            { text: 'Verify identity and apply relevant transaction restrictions.' },
            { text: 'Process payments, record gold holdings and manage redemptions.' },
            { text: 'Send service messages about login, purchases and collections.' },
            { text: 'Respond to support requests and resolve complaints.' },
            { text: 'Detect misuse, investigate disputes and protect the service.' },
            { text: 'Maintain records and meet applicable legal obligations.' },
          ],
        },
        {
          kind: 'paragraph',
          text: 'Optional promotional communications will be handled separately from messages needed to deliver the service.',
        },
      ],
    },
    {
      id: 'who-receives',
      heading: 'Who receives information',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Information may be shared, as necessary for these purposes, with:',
        },
        {
          kind: 'list',
          items: [
            { text: 'Authorised staff of your selected Jeweller.' },
            { text: 'The platform operator and its authorised service providers.' },
            { text: 'Payment processors, including Razorpay where used.' },
            { text: 'OTP, SMS or WhatsApp providers where those channels are enabled.' },
            { text: 'Hosting, infrastructure and support providers.' },
            {
              text: 'Professional advisers or public authorities where disclosure is legally required or otherwise permitted.',
            },
          ],
        },
        {
          kind: 'paragraph',
          text: 'The providers and processing locations relevant to this storefront are [Verified Provider List and Countries].',
        },
        {
          kind: 'paragraph',
          text: 'Access by another jewellery business is not authorised merely because it also uses DigiGold.',
        },
      ],
    },
    {
      id: 'browser-storage',
      heading: 'Browser storage',
      blocks: [
        {
          kind: 'paragraph',
          text: 'The application uses browser local storage and session storage to maintain authentication and registration sessions.',
        },
        {
          kind: 'paragraph',
          text: 'Clearing this storage or blocking it may sign you out or interrupt registration. Additional cookies or optional tracking tools used by this service are [Verified Cookie and Tracking Details, Including Available Controls].',
        },
      ],
    },
    {
      id: 'retention',
      heading: 'Retention',
      blocks: [
        {
          kind: 'paragraph',
          text: 'We retain personal information for the purposes described in this policy and for applicable legal, accounting, security and dispute-resolution requirements. The retention periods or criteria are:',
        },
        {
          kind: 'list',
          items: [
            {
              label: 'Account and verification records',
              text: '[Retention Period or Criteria].',
            },
            {
              label: 'Transaction and redemption records',
              text: '[Retention Period or Applicable Recordkeeping Requirement].',
            },
            {
              label: 'Support and technical logs',
              text: '[Retention Period or Criteria].',
            },
          ],
        },
        {
          kind: 'paragraph',
          text: 'Closing an account does not immediately remove records that must be retained. Information is deleted or anonymised when its retention is no longer necessary, subject to applicable requirements.',
        },
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      blocks: [
        {
          kind: 'paragraph',
          text: 'We apply [Verified Technical and Organisational Safeguards] to protect personal information and restrict access to authorised persons.',
        },
        {
          kind: 'paragraph',
          text: 'If a security incident affects your information, we will investigate and provide notifications where required by applicable law.',
        },
      ],
    },
    {
      id: 'your-choices',
      heading: 'Your choices and requests',
      blocks: [
        {
          kind: 'paragraph',
          text: 'You may contact [Privacy Contact Email] to request access to your information, correction of inaccurate details, account closure or deletion of information, subject to applicable law and retention requirements.',
        },
        {
          kind: 'paragraph',
          text: 'Where processing depends on consent, you may request withdrawal of that consent. We will explain any resulting effect on services that require the information.',
        },
        {
          kind: 'paragraph',
          text: 'We may verify your identity before acting on a request. You may also contact the grievance officer listed in our business details about privacy concerns.',
        },
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      blocks: [
        {
          kind: 'paragraph',
          text: 'The service is intended for adults aged 18 and above. If you believe a child has provided personal information through the application, contact [Privacy Contact Email] so we can investigate and take appropriate action.',
        },
      ],
    },
    {
      id: 'updates',
      heading: 'Policy updates',
      blocks: [
        {
          kind: 'paragraph',
          text: 'We may update this policy when our information practices or legal requirements change. The latest version will show its effective and last-updated dates. We will provide additional notice or obtain consent where required.',
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
