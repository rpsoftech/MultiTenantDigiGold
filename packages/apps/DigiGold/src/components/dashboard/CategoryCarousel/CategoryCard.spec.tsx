import { render, screen } from '@testing-library/react';
import { CategoryCard } from './CategoryCard';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const category = {
  id: 'rings',
  label: 'Rings',
  imageUrl: '/rings.png',
  imageAlt: 'A gold ring',
  url: '/marketplace/rings',
};

describe('CategoryCard', () => {
  it('links to the category page', () => {
    render(<CategoryCard category={category} />);

    expect(screen.getByRole('link').getAttribute('href')).toBe('/marketplace/rings');
  });

  it('shows the image with its alt text and the label', () => {
    render(<CategoryCard category={category} />);

    expect((screen.getByAltText('A gold ring') as HTMLImageElement).getAttribute('src')).toBe('/rings.png');
    expect(screen.getByText('Rings')).toBeTruthy();
  });
});
