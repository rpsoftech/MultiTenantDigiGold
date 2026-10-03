import { fireEvent, render, screen } from '@testing-library/react';
import { HeaderActionLink } from './HeaderActionLink';
import type { HeaderAction } from './Header.types';

const action: HeaderAction = {
  id: 'sign-in',
  label: 'Sign In',
  url: '/login',
  type: 'link',
  enabled: true,
  order: 1,
};

describe('HeaderActionLink', () => {
  it('links to the action url with its label', () => {
    render(<HeaderActionLink action={action} />);

    const link = screen.getByRole('link', { name: 'Sign In' });
    expect(link.getAttribute('href')).toBe('/login');
    expect(link.getAttribute('target')).toBe('_self');
    expect(link.getAttribute('rel')).toBeNull();
  });

  it('opens external actions in a new tab with a safe rel', () => {
    render(<HeaderActionLink action={{ ...action, target: '_blank', url: 'https://example.com' }} />);

    const link = screen.getByRole('link', { name: 'Sign In' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders the configured icon', () => {
    const { container } = render(<HeaderActionLink action={{ ...action, icon: 'user' }} />);

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders no icon when none is configured', () => {
    const { container } = render(<HeaderActionLink action={action} />);

    expect(container.querySelector('svg')).toBeNull();
  });

  it('styles button actions differently from link actions', () => {
    const { rerender } = render(<HeaderActionLink action={action} />);
    const linkClass = screen.getByRole('link').className;

    rerender(<HeaderActionLink action={{ ...action, type: 'button' }} />);

    expect(screen.getByRole('link').className).not.toBe(linkClass);
  });

  it('adds an extra class and reports clicks', () => {
    const onClick = jest.fn();
    render(<HeaderActionLink action={action} className="extra" onClick={onClick} />);

    const link = screen.getByRole('link');
    fireEvent.click(link);

    expect(link.className).toContain('extra');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
