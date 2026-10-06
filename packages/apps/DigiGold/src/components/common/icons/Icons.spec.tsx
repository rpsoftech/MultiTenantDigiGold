import { render } from '@testing-library/react';
import * as Icons from './Icons';
import { ICON_REGISTRY } from './iconRegistry';

const iconComponents = Object.entries(Icons).filter(
  ([name, value]) => name.endsWith('Icon') && typeof value === 'function',
) as Array<[string, React.ComponentType<React.SVGProps<SVGSVGElement>>]>;

describe('Icons', () => {
  it('exports a healthy set of icons', () => {
    expect(iconComponents.length).toBeGreaterThanOrEqual(26);
  });

  it.each(iconComponents)(
    '%s renders an svg that is hidden from screen readers',
    (_name, Icon) => {
      const { container } = render(<Icon />);

      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('width')).toBe('20');
    },
  );

  it.each(iconComponents)(
    '%s accepts size and class overrides',
    (_name, Icon) => {
      const { container } = render(
        <Icon width={32} height={32} className="custom" />,
      );

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('32');
      expect(svg?.getAttribute('class')).toContain('custom');
    },
  );
});

describe('header icon registry', () => {
  it('maps every key to its icon component', () => {
    expect(Object.keys(ICON_REGISTRY).sort()).toEqual([
      'arrow-right',
      'home',
      'lock',
      'shield',
      'user',
    ]);
    expect(ICON_REGISTRY.home).toBe(Icons.HomeIcon);
    expect(ICON_REGISTRY.lock).toBe(Icons.LockIcon);
    expect(ICON_REGISTRY.user).toBe(Icons.UserIcon);
    expect(ICON_REGISTRY.shield).toBe(Icons.ShieldIcon);
    expect(ICON_REGISTRY['arrow-right']).toBe(Icons.ArrowRightIcon);
  });
});
