import { act, fireEvent, render, screen } from '@testing-library/react';
import { usePromoCarouselConfig } from './usePromoCarouselConfig';
import { PromoCarousel } from './PromoCarousel';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
jest.mock('./usePromoCarouselConfig', () => ({
  usePromoCarouselConfig: jest.fn(),
}));

const mockedConfig = usePromoCarouselConfig as jest.Mock;

const slides = [
  {
    id: 'a',
    imageUrl: '/a.png',
    imageAlt: 'First offer',
    linkUrl: '/offers/a',
    enabled: true,
    order: 1,
  },
  {
    id: 'b',
    imageUrl: '/b.png',
    imageAlt: 'Second offer',
    enabled: true,
    order: 2,
  },
  {
    id: 'c',
    imageUrl: '/c.png',
    imageAlt: 'Third offer',
    linkUrl: '/offers/c',
    enabled: true,
    order: 3,
  },
];

const dot = (index: number) =>
  screen.getByRole('tab', { name: `Show slide ${index} of 3` });
const track = () =>
  screen.getByAltText('First offer').closest('a')?.parentElement as HTMLElement;

describe('PromoCarousel', () => {
  beforeEach(() => {
    mockedConfig.mockReturnValue({ slides, autoplayIntervalMs: 5000 });
  });

  it('renders nothing when there are no slides', () => {
    mockedConfig.mockReturnValue({ slides: [], autoplayIntervalMs: 5000 });
    const { container } = render(<PromoCarousel />);

    expect(container.firstChild).toBeNull();
  });

  it('renders every slide image', () => {
    render(<PromoCarousel />);

    for (const alt of ['First offer', 'Second offer', 'Third offer']) {
      expect(screen.getByAltText(alt)).toBeTruthy();
    }
  });

  it('makes a slide with a link clickable and leaves the others plain', () => {
    render(<PromoCarousel />);

    expect(
      screen.getByRole('link', { name: 'First offer' }).getAttribute('href'),
    ).toBe('/offers/a');
    expect(
      screen.getByRole('link', { name: 'Third offer' }).getAttribute('href'),
    ).toBe('/offers/c');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('starts on the first slide', () => {
    render(<PromoCarousel />);

    expect(dot(1).getAttribute('aria-selected')).toBe('true');
    expect(track().style.transform).toBe('translateX(-0%)');
  });

  it('jumps to a slide from its dot', () => {
    render(<PromoCarousel />);

    fireEvent.click(dot(3));

    expect(dot(3).getAttribute('aria-selected')).toBe('true');
    expect(dot(1).getAttribute('aria-selected')).toBe('false');
    expect(track().style.transform).toBe('translateX(-200%)');
  });

  it('shows no dots for a single slide', () => {
    mockedConfig.mockReturnValue({
      slides: [slides[0]],
      autoplayIntervalMs: 5000,
    });
    render(<PromoCarousel />);

    expect(screen.queryByRole('tablist')).toBeNull();
  });

  describe('autoplay', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('moves to the next slide after the configured interval', () => {
      render(<PromoCarousel />);

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(dot(2).getAttribute('aria-selected')).toBe('true');
    });

    it('wraps around to the first slide after the last', () => {
      render(<PromoCarousel />);

      for (let i = 0; i < 3; i += 1) {
        act(() => {
          jest.advanceTimersByTime(5000);
        });
      }

      expect(dot(1).getAttribute('aria-selected')).toBe('true');
    });

    it('restarts the timer when a dot is chosen', () => {
      render(<PromoCarousel />);
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      fireEvent.click(dot(3));
      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(dot(3).getAttribute('aria-selected')).toBe('true');

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(dot(1).getAttribute('aria-selected')).toBe('true');
    });

    it('does not autoplay a single slide', () => {
      mockedConfig.mockReturnValue({
        slides: [slides[0]],
        autoplayIntervalMs: 5000,
      });
      render(<PromoCarousel />);

      act(() => {
        jest.advanceTimersByTime(20000);
      });

      expect(track().style.transform).toBe('translateX(-0%)');
    });

    it('stops its timer on unmount', () => {
      const { unmount } = render(<PromoCarousel />);

      expect(() => {
        unmount();
        act(() => {
          jest.advanceTimersByTime(20000);
        });
      }).not.toThrow();
    });
  });
});
