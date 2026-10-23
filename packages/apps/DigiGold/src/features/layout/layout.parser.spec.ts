import { parseLayout } from './layout.parser';
import { MAX_LAYOUT_BLOCKS, MAX_LAYOUT_DEPTH } from './layout.types';

describe('parseLayout', () => {
  it('reads a published array of blocks in saved order', () => {
    const blocks = parseLayout([
      { id: 'a', type: 'LiveRate', variant: '1', props: {} },
      { id: 'b', type: 'Hero', variant: '1', props: { title: 'Hi' } },
    ]);

    expect(blocks.map((block) => block.id)).toEqual(['a', 'b']);
    expect(blocks[1]).toEqual({
      id: 'b',
      type: 'Hero',
      variant: '1',
      props: { title: 'Hi' },
      children: [],
    });
  });

  it('reads blocks stored under `layout` next to the theme object', () => {
    const blocks = parseLayout({
      theme: { colors: {} },
      layout: [{ id: 'a', type: 'Hero', variant: '1' }],
    });

    expect(blocks).toHaveLength(1);
  });

  it.each([null, undefined, '', 'text', 42, true, {}, [], { layout: 'nope' }])(
    'treats %p as an empty layout',
    (value) => {
      expect(parseLayout(value)).toEqual([]);
    },
  );

  it('drops items that are not objects or have no usable type', () => {
    const blocks = parseLayout([
      null,
      'Hero',
      7,
      [],
      { id: 'x' },
      { id: 'y', type: '' },
      { id: 'z', type: '  ' },
      { id: 'w', type: 'bad type!' },
      { id: 'v', type: 42 },
      { id: 'ok', type: 'Hero' },
    ]);

    expect(blocks.map((block) => block.id)).toEqual(['ok']);
  });

  it('defaults the variant to 1 and accepts a numeric variant', () => {
    const blocks = parseLayout([
      { id: 'a', type: 'Hero' },
      { id: 'b', type: 'Hero', variant: 2 },
    ]);

    expect(blocks.map((block) => block.variant)).toEqual(['1', '2']);
  });

  it('ignores props that are not a plain object', () => {
    const blocks = parseLayout([
      { id: 'a', type: 'Hero', props: 'x' },
      { id: 'b', type: 'Hero', props: ['x'] },
      { id: 'c', type: 'Hero', props: null },
    ]);

    expect(blocks.map((block) => block.props)).toEqual([{}, {}, {}]);
  });

  it('gives every block a unique id', () => {
    const blocks = parseLayout([
      { id: 'dup', type: 'Hero' },
      { id: 'dup', type: 'Hero' },
      { id: 'dup', type: 'LiveRate' },
      { type: 'Hero' },
      { id: '', type: 'Hero' },
    ]);

    const ids = blocks.map((block) => block.id);
    expect(ids[0]).toBe('dup');
    expect(new Set(ids).size).toBe(blocks.length);
  });

  it('accepts numeric ids', () => {
    expect(parseLayout([{ id: 7, type: 'Hero' }])[0].id).toBe('7');
  });

  it('parses nested children', () => {
    const [block] = parseLayout([
      {
        id: 'p',
        type: 'Hero',
        children: [{ id: 'c', type: 'LiveRate' }, 'junk'],
      },
    ]);

    expect(block.children.map((child) => child.id)).toEqual(['c']);
  });

  it('stops descending past the depth limit', () => {
    let nested: Record<string, unknown> = { id: 'leaf', type: 'Hero' };
    for (let level = 0; level < MAX_LAYOUT_DEPTH + 2; level += 1) {
      nested = { id: `n${level}`, type: 'Hero', children: [nested] };
    }

    let depth = 0;
    let current = parseLayout([nested]);
    while (current.length) {
      depth += 1;
      current = current[0].children;
    }

    expect(depth).toBe(MAX_LAYOUT_DEPTH);
  });

  it('caps the total number of blocks', () => {
    const many = Array.from({ length: MAX_LAYOUT_BLOCKS + 20 }, (_, index) => ({
      id: `b${index}`,
      type: 'Hero',
    }));

    expect(parseLayout(many)).toHaveLength(MAX_LAYOUT_BLOCKS);
  });
});
