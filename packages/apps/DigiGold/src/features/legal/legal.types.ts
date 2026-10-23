export type LegalListItem = {
  // Bold lead-in, e.g. "Account information".
  label?: string;
  text: string;
};

export type LegalBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: LegalListItem[] }
  | { kind: 'link'; label: string; href: string }
  | { kind: 'details'; rows: { label: string; value: string }[] };

export type LegalSection = {
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

export type LegalContent = {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: LegalSection[];
};

// Text in [square brackets] is a placeholder awaiting approved business details.
// [Store Name] is filled from the tenant config when the page renders.
export const STORE_NAME_PLACEHOLDER = '[Store Name]';
