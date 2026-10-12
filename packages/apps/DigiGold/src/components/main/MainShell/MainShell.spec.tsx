import { render, screen } from '@testing-library/react';
import { MainShell } from './MainShell';

jest.mock('@/components/common/Header/Header', () => ({
  Header: () => <header data-testid="header" />,
}));
jest.mock('@/components/common/Footer/Footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}));

describe('MainShell', () => {
  it('wraps the page content with the header and footer', () => {
    render(
      <MainShell>
        <p>page content</p>
      </MainShell>,
    );

    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.getByTestId('footer')).toBeTruthy();
    expect(screen.getByRole('main').textContent).toBe('page content');
  });

  it('places the header before the content and the footer after it', () => {
    render(
      <MainShell>
        <p>page content</p>
      </MainShell>,
    );

    const order = Array.from(
      screen.getByTestId('header').parentElement?.children ?? [],
    ).map((element) => element.tagName);
    expect(order).toEqual(['HEADER', 'MAIN', 'FOOTER']);
  });
});
