import { render, screen } from '@testing-library/react';
import { AuthShell } from './AuthShell';

jest.mock('@/components/common/Header/Header', () => ({
  Header: () => <header data-testid="header" />,
}));
jest.mock('@/components/common/Footer/Footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}));

describe('AuthShell', () => {
  it('wraps the page content with the header and footer', () => {
    render(
      <AuthShell>
        <p>login content</p>
      </AuthShell>,
    );

    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.getByTestId('footer')).toBeTruthy();
    expect(screen.getByRole('main').textContent).toBe('login content');
  });

  it('places the header before the content and the footer after it', () => {
    render(
      <AuthShell>
        <p>login content</p>
      </AuthShell>,
    );

    const order = Array.from(
      screen.getByTestId('header').parentElement?.children ?? [],
    ).map((element) => element.tagName);
    expect(order).toEqual(['HEADER', 'MAIN', 'FOOTER']);
  });
});
