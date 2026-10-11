import { render, screen } from '@testing-library/react';
import { ProductImage } from './ProductImage';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

describe('ProductImage', () => {
  it('shows the product photo', () => {
    render(<ProductImage src="/ring.jpg" alt="Gold ring" sizes="100vw" />);

    expect(screen.getByRole('img', { name: 'Gold ring' }).getAttribute('src')).toBe('/ring.jpg');
  });

  it('says there is no photo yet instead of showing another product', () => {
    render(<ProductImage src="" alt="Gold anklet" sizes="100vw" />);

    expect(screen.getByRole('img', { name: 'Gold anklet: no photo yet' }).textContent).toBe(
      'No photo yet',
    );
  });
});
