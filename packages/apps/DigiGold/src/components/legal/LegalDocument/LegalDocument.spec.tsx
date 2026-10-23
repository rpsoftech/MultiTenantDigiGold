import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { TERMS_OF_SERVICE } from '@/features/legal/terms.content';
import { PRIVACY_POLICY } from '@/features/legal/privacy.content';
import type { LegalContent } from '@/features/legal/legal.types';
import { LEGAL_PLACEHOLDER_VALUES } from '@/features/legal/legal.mock';
import { LegalDocument } from './LegalDocument';

const content: LegalContent = {
  title: 'Sample Terms',
  effectiveDate: '1 January 2026',
  lastUpdated: '2 February 2026',
  sections: [
    {
      id: 'one',
      heading: 'First',
      blocks: [
        { kind: 'paragraph', text: 'Welcome to [Store Name].' },
        {
          kind: 'list',
          items: [
            { label: 'Lead', text: 'with label' },
            { text: 'plain item' },
          ],
        },
        { kind: 'link', label: 'Read notice', href: 'https://example.com/n' },
      ],
    },
    {
      id: 'two',
      heading: 'Second',
      blocks: [
        {
          kind: 'details',
          rows: [{ label: 'Seller', value: '[Store Name] Pvt Ltd' }],
        },
      ],
    },
  ],
};

const acme = {
  tenant: { config: { ...DEFAULT_TENANT_CONFIG, displayName: 'Acme Jewellers' } },
};

describe('LegalDocument', () => {
  it('shows the title and both dates', () => {
    renderWithProviders(<LegalDocument content={content} />, { user: null });

    expect(screen.getByRole('heading', { level: 1, name: 'Sample Terms' })).toBeTruthy();
    expect(screen.getByText('Effective date: 1 January 2026')).toBeTruthy();
    expect(screen.getByText('Last updated: 2 February 2026')).toBeTruthy();
  });

  it('renders each section as a heading with paragraphs, lists and details', () => {
    renderWithProviders(<LegalDocument content={content} />, { user: null });

    expect(screen.getByRole('heading', { level: 2, name: /First/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Second/ })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Seller')).toBeTruthy();
  });

  it('opens external links in a new tab safely', () => {
    renderWithProviders(<LegalDocument content={content} />, { user: null });

    const link = screen.getByRole('link', { name: 'Read notice' });
    expect(link.getAttribute('href')).toBe('https://example.com/n');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('fills the store name from the tenant', () => {
    renderWithProviders(<LegalDocument content={content} />, {
      user: null,
      preloaded: acme,
    });

    expect(screen.getByText('Welcome to Acme Jewellers.')).toBeTruthy();
    expect(screen.getByText('Acme Jewellers Pvt Ltd')).toBeTruthy();
  });

  it('falls back to the platform name before a tenant is known', () => {
    renderWithProviders(<LegalDocument content={content} />, {
      user: null,
      preloaded: { tenant: { config: null } },
    });

    expect(screen.getByText('Welcome to DigiGold.')).toBeTruthy();
  });

  it('fills other placeholders with the dummy values and leaves unknown ones', () => {
    renderWithProviders(
      <LegalDocument
        content={{
          ...content,
          effectiveDate: '[Effective Date]',
          sections: [
            {
              id: 'x',
              heading: 'X',
              blocks: [
                { kind: 'paragraph', text: 'Write to [Support Email] or [Mystery].' },
              ],
            },
          ],
        }}
      />,
      { user: null },
    );

    expect(screen.getByText('Effective date: 1 January 2026')).toBeTruthy();
    expect(screen.getByText('Write to support@example.com or [Mystery].')).toBeTruthy();
  });

  it('sends a logged-out visitor back to login', () => {
    renderWithProviders(<LegalDocument content={content} />, { user: null });

    expect(
      screen.getByRole('link', { name: /Back to login/ }).getAttribute('href'),
    ).toBe('/login');
  });

  it('sends a logged-in customer back to the app', () => {
    renderWithProviders(<LegalDocument content={content} />);

    expect(
      screen.getByRole('link', { name: /Back to app/ }).getAttribute('href'),
    ).toBe('/home');
  });
});

describe('approved content', () => {
  it('has a dummy value for every placeholder except the store name', () => {
    const tokens =
      JSON.stringify([TERMS_OF_SERVICE, PRIVACY_POLICY]).match(
        /\[[A-Z][^\][{}"]*\]/g,
      ) ?? [];
    const missing = [...new Set(tokens)].filter(
      (token) => token !== '[Store Name]' && !(token in LEGAL_PLACEHOLDER_VALUES),
    );

    expect(missing).toEqual([]);
  });

  it.each([
    ['terms', TERMS_OF_SERVICE, 13],
    ['privacy policy', PRIVACY_POLICY, 11],
  ])('%s has all its sections, dates and business details', (_, doc, count) => {
    expect(doc.sections).toHaveLength(count);
    expect(doc.effectiveDate).toBeTruthy();
    expect(doc.lastUpdated).toBeTruthy();
    expect(doc.sections.at(-1)?.heading).toBe('Business details');
  });
});
