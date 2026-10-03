import { render, screen } from '@testing-library/react';
import { Loader, Skeleton } from './Loader';

describe('Loader', () => {
  it('is a status element with a default label', () => {
    render(<Loader />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });

  it('uses a custom label for assistive tech', () => {
    render(<Loader label="Loading passbook" />);

    expect(screen.getByRole('status', { name: 'Loading passbook' })).toBeTruthy();
  });

  it('supports a small size and extra classes', () => {
    render(<Loader size="sm" className="extra" />);

    const loader = screen.getByRole('status');
    expect(loader.className).toContain('sm');
    expect(loader.className).toContain('extra');
  });

  it('defaults to the medium size', () => {
    render(<Loader />);

    expect(screen.getByRole('status').className).toContain('md');
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive tech', () => {
    const { container } = render(<Skeleton />);

    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('fills the width and is one line tall by default', () => {
    const { container } = render(<Skeleton />);

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.style.width).toBe('100%');
    expect(skeleton.style.height).toBe('1rem');
  });

  it('takes a custom size and rounded corners', () => {
    const { container } = render(<Skeleton width={120} height="2rem" rounded className="extra" />);

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.style.width).toBe('120px');
    expect(skeleton.style.height).toBe('2rem');
    expect(skeleton.className).toContain('skeletonRounded');
    expect(skeleton.className).toContain('extra');
  });
});
