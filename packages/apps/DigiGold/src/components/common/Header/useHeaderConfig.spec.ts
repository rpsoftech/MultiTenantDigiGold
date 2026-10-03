import { renderHook } from '@testing-library/react';
import { useHeaderConfig } from './useHeaderConfig';

jest.mock('./header.config.json', () => ({
  logo: { url: '/home', text: 'Acme' },
  menus: [
    { id: 'late', label: 'Late', url: '/late', enabled: true, order: 3 },
    { id: 'off', label: 'Off', url: '/off', enabled: false, order: 1 },
    {
      id: 'parent',
      label: 'Parent',
      url: '#',
      enabled: true,
      order: 2,
      children: [
        { id: 'child-b', label: 'B', url: '/b', enabled: true, order: 2 },
        { id: 'child-off', label: 'Off child', url: '/x', enabled: false, order: 1 },
        { id: 'child-a', label: 'A', url: '/a', enabled: true, order: 1 },
      ],
    },
    { id: 'leaf', label: 'Leaf', url: '/leaf', enabled: true, order: 1, children: [] },
  ],
  actions: [
    { id: 'second', label: 'Second', url: '/s', type: 'button', enabled: true, order: 2 },
    { id: 'hidden', label: 'Hidden', url: '/h', type: 'link', enabled: false, order: 0 },
    { id: 'first', label: 'First', url: '/f', type: 'link', enabled: true, order: 1 },
  ],
}));

describe('useHeaderConfig', () => {
  it('passes the logo config through', () => {
    const { result } = renderHook(() => useHeaderConfig());

    expect(result.current.logo).toEqual({ url: '/home', text: 'Acme' });
  });

  it('drops disabled menu items and sorts the rest by order', () => {
    const { result } = renderHook(() => useHeaderConfig());

    expect(result.current.menus.map((item) => item.id)).toEqual(['leaf', 'parent', 'late']);
  });

  it('applies the same rules to nested menu items', () => {
    const { result } = renderHook(() => useHeaderConfig());
    const parent = result.current.menus.find((item) => item.id === 'parent');

    expect(parent?.children?.map((child) => child.id)).toEqual(['child-a', 'child-b']);
  });

  it('treats an empty children list as no children', () => {
    const { result } = renderHook(() => useHeaderConfig());
    const leaf = result.current.menus.find((item) => item.id === 'leaf');

    expect(leaf?.children).toBeUndefined();
  });

  it('drops disabled actions and sorts the rest by order', () => {
    const { result } = renderHook(() => useHeaderConfig());

    expect(result.current.actions.map((action) => action.id)).toEqual(['first', 'second']);
  });

  it('returns the same object across renders', () => {
    const { result, rerender } = renderHook(() => useHeaderConfig());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
