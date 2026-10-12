import { renderHook } from '@testing-library/react';
import { useFooterConfig } from './useFooterConfig';

jest.mock('./footer.config.json', () => ({
  columns: [
    {
      id: 'legal',
      label: 'Legal',
      enabled: true,
      order: 2,
      links: [
        { id: 'terms', label: 'Terms', url: '/terms', enabled: true, order: 2 },
        { id: 'hidden', label: 'Hidden', url: '/h', enabled: false, order: 0 },
        {
          id: 'privacy',
          label: 'Privacy',
          url: '/privacy',
          enabled: true,
          order: 1,
        },
      ],
    },
    { id: 'off', label: 'Off', enabled: false, order: 0, links: [] },
    {
      id: 'empty',
      label: 'Empty',
      enabled: true,
      order: 3,
      links: [
        {
          id: 'later',
          label: 'Later',
          url: '/later',
          enabled: false,
          order: 1,
        },
      ],
    },
    {
      id: 'company',
      label: 'Company',
      enabled: true,
      order: 1,
      links: [
        { id: 'about', label: 'About', url: '/about', enabled: true, order: 1 },
      ],
    },
  ],
}));

describe('useFooterConfig', () => {
  it('drops disabled columns, and columns with no enabled link, and sorts the rest', () => {
    const { result } = renderHook(() => useFooterConfig());

    expect(result.current.columns.map((column) => column.id)).toEqual([
      'company',
      'legal',
    ]);
  });

  it('drops disabled links and sorts the rest by order within each column', () => {
    const { result } = renderHook(() => useFooterConfig());
    const legal = result.current.columns.find(
      (column) => column.id === 'legal',
    );

    expect(legal?.links.map((link) => link.id)).toEqual(['privacy', 'terms']);
  });

  it('returns the same object across renders', () => {
    const { result, rerender } = renderHook(() => useFooterConfig());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
