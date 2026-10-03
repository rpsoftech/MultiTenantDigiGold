import { act, fireEvent, render, screen } from '@testing-library/react';
import { useCategories } from '@/features/marketplace/hooks/useCategories';
import type { Category } from '@/features/marketplace/marketplace.types';
import { CategoryCarousel } from './CategoryCarousel';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
jest.mock('@/features/marketplace/hooks/useCategories', () => ({
  useCategories: jest.fn(),
}));

const mockedUseCategories = useCategories as jest.Mock;

const categories: Category[] = [
  { id: 'rings', label: 'Rings', imageUrl: '/rings.png', imageAlt: 'Rings', url: '/marketplace/rings' },
  { id: 'chains', label: 'Chains', imageUrl: '/chains.png', imageAlt: 'Chains', url: '/marketplace/chains' },
  { id: 'coins', label: 'Coins', imageUrl: '/coins.png', imageAlt: 'Coins', url: '/marketplace/coins' },
];

// jsdom does no layout, so scroll geometry is faked on the track element.
let scrollLeft = 0;
let scrollWidth = 1000;
let clientWidth = 300;
const scrollBy = jest.fn();
const scrollTo = jest.fn();

function track(): HTMLElement {
  return screen.getByRole('link', { name: /Rings/ }).parentElement as HTMLElement;
}

describe('CategoryCarousel', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      get: () => scrollLeft,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => scrollWidth,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => clientWidth,
    });
    HTMLElement.prototype.scrollBy = scrollBy as never;
    HTMLElement.prototype.scrollTo = scrollTo as never;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    scrollLeft = 0;
    scrollWidth = 1000;
    clientWidth = 300;
    mockedUseCategories.mockReturnValue({ data: categories, isLoading: false });
  });

  it('shows the section title from the site config', () => {
    render(<CategoryCarousel />);

    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('shows a loader while categories load', () => {
    mockedUseCategories.mockReturnValue({ data: undefined, isLoading: true });
    render(<CategoryCarousel />);

    expect(screen.getByRole('status', { name: 'Loading categories' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Rings/ })).toBeNull();
  });

  it('shows an empty message when there are no categories', () => {
    mockedUseCategories.mockReturnValue({ data: [], isLoading: false });
    render(<CategoryCarousel />);

    expect(screen.getByText('No categories available right now.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Scroll categories/ })).toBeNull();
  });

  it('shows nothing extra when the request failed', () => {
    mockedUseCategories.mockReturnValue({ data: undefined, isLoading: false });
    render(<CategoryCarousel />);

    expect(screen.queryByText('No categories available right now.')).toBeNull();
  });

  it('links each category to its page', () => {
    render(<CategoryCarousel />);

    expect(screen.getByRole('link', { name: /Rings/ }).getAttribute('href')).toBe('/marketplace/rings');
    expect(screen.getByRole('link', { name: /Coins/ }).getAttribute('href')).toBe('/marketplace/coins');
  });

  describe('arrow buttons', () => {
    it('hides the left arrow at the start and shows the right one', () => {
      render(<CategoryCarousel />);

      expect(screen.getByRole('button', { name: 'Scroll categories left' }).className).toContain(
        'navButtonHidden',
      );
      expect(screen.getByRole('button', { name: 'Scroll categories right' }).className).not.toContain(
        'navButtonHidden',
      );
    });

    it('shows the left arrow and hides the right one after scrolling to the end', () => {
      render(<CategoryCarousel />);

      scrollLeft = 700;
      fireEvent.scroll(track());

      expect(screen.getByRole('button', { name: 'Scroll categories left' }).className).not.toContain(
        'navButtonHidden',
      );
      expect(screen.getByRole('button', { name: 'Scroll categories right' }).className).toContain(
        'navButtonHidden',
      );
    });

    it('hides both arrows when everything already fits', () => {
      scrollWidth = 300;
      render(<CategoryCarousel />);

      expect(screen.getByRole('button', { name: 'Scroll categories left' }).className).toContain(
        'navButtonHidden',
      );
      expect(screen.getByRole('button', { name: 'Scroll categories right' }).className).toContain(
        'navButtonHidden',
      );
    });

    it('scrolls the track by one step in the chosen direction', () => {
      render(<CategoryCarousel />);

      fireEvent.click(screen.getByRole('button', { name: 'Scroll categories right' }));
      expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: 'smooth' });

      fireEvent.click(screen.getByRole('button', { name: 'Scroll categories left' }));
      expect(scrollBy).toHaveBeenLastCalledWith({ left: -240, behavior: 'smooth' });
    });
  });

  describe('autoplay', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('scrolls forward every three seconds', () => {
      render(<CategoryCarousel />);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' });
    });

    it('returns to the start once the end has been reached', () => {
      render(<CategoryCarousel />);
      scrollLeft = 700;

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('pauses while the pointer is over the carousel and resumes after', () => {
      render(<CategoryCarousel />);
      const carousel = track().parentElement as HTMLElement;

      fireEvent.mouseEnter(carousel);
      act(() => {
        jest.advanceTimersByTime(9000);
      });
      expect(scrollBy).not.toHaveBeenCalled();

      fireEvent.mouseLeave(carousel);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(scrollBy).toHaveBeenCalledTimes(1);
    });

    it('does not autoplay a single category', () => {
      mockedUseCategories.mockReturnValue({ data: [categories[0]], isLoading: false });
      render(<CategoryCarousel />);

      act(() => {
        jest.advanceTimersByTime(9000);
      });

      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('stops autoplay on unmount', () => {
      const { unmount } = render(<CategoryCarousel />);

      unmount();
      act(() => {
        jest.advanceTimersByTime(9000);
      });

      expect(scrollBy).not.toHaveBeenCalled();
    });
  });
});
