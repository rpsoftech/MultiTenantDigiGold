import { selectHeaderOverride } from './headerOverride';
import type { LayoutBlock } from './layout.types';

const block = (over: Partial<LayoutBlock>): LayoutBlock => ({
  id: 'h',
  type: 'Header',
  variant: '1',
  props: {},
  children: [],
  ...over,
});

describe('selectHeaderOverride', () => {
  it('returns null without a layout or a Header block', () => {
    expect(selectHeaderOverride(null)).toBeNull();
    expect(selectHeaderOverride(undefined)).toBeNull();
    expect(selectHeaderOverride([block({ type: 'Hero' })])).toBeNull();
    expect(selectHeaderOverride([block({ variant: '2' })])).toBeNull();
  });

  it('parses the first Header block', () => {
    const override = selectHeaderOverride([
      block({ props: { brandName: 'Acme' } }),
      block({ id: 'h2', props: { brandName: 'Other' } }),
    ]);

    expect(override?.brandName).toBe('Acme');
  });
});
