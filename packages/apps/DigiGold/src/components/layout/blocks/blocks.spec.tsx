import { fireEvent, screen } from '@testing-library/react';
import { installMatchMedia, renderWithProviders } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { useLiveRate } from '@/features/market/hooks/useLiveRate';
import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio';
import type { MarketRate } from '@/features/market/market.types';
import { parseHeroProps } from '@/features/layout/layout.props';
import { HeroBlock } from './HeroBlock/HeroBlock';
import { LiveRateBlock } from './LiveRateBlock/LiveRateBlock';
import { PortfolioSummaryBlock } from './PortfolioSummaryBlock/PortfolioSummaryBlock';
import { QuickActionsBlock } from './QuickActionsBlock/QuickActionsBlock';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
}));
jest.mock('@/components/dashboard/BuyGold/BuyGold', () => ({
  BUY_GOLD_SECTION_ID: 'buy-gold',
  BuyGold: () => <div>buy gold card</div>,
}));
jest.mock('@/features/market/hooks/useLiveRate', () => ({ useLiveRate: jest.fn() }));
jest.mock('@/features/portfolio/hooks/usePortfolio', () => ({ usePortfolio: jest.fn() }));

const mockedLiveRate = useLiveRate as jest.MockedFunction<typeof useLiveRate>;
const mockedPortfolio = usePortfolio as jest.MockedFunction<typeof usePortfolio>;

const rate: MarketRate = {
  pricePerGramInr: 7650.5,
  mcxBaseRateInr: 7400,
  marginAppliedInr: 100,
  gstAppliedInr: 150.5,
  bidPerGramInr: 7400,
  askPerGramInr: 7500,
  purityLabel: '24K • 99.99%',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const context = { isFirstOfType: true };

function tenant(modules: Partial<typeof DEFAULT_TENANT_CONFIG.activeModules> = {}) {
  return {
    tenant: {
      config: {
        ...DEFAULT_TENANT_CONFIG,
        activeModules: { ...DEFAULT_TENANT_CONFIG.activeModules, ...modules },
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  installMatchMedia(true);
});

describe('HeroBlock', () => {
  it('shows the published copy as the page heading', () => {
    renderWithProviders(
      <HeroBlock
        props={parseHeroProps({ title: 'Festive offer', subtitle: 'Save big', ctaText: 'Shop' })}
        context={context}
      />,
      { user: null }
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Festive offer' })).toBeTruthy();
    expect(screen.getByText('Save big')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shop' })).toBeTruthy();
  });

  it('is only an h2 when another hero came first', () => {
    renderWithProviders(
      <HeroBlock props={parseHeroProps({ title: 'Second' })} context={{ isFirstOfType: false }} />,
      { user: null }
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Second' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('applies a safe background and a computed readable text colour', () => {
    const { container } = renderWithProviders(
      <HeroBlock props={parseHeroProps({ backgroundColor: '#111111' })} context={context} />,
      { user: null }
    );

    const section = container.querySelector('section') as HTMLElement;
    expect(section.style.background).toBeTruthy();
    expect(section.style.color).toBeTruthy();
  });

  it('sends a signed-out visitor to login from the call to action', () => {
    renderWithProviders(<HeroBlock props={parseHeroProps({})} context={context} />, {
      user: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Buy Gold' }));

    expect(push).toHaveBeenCalledWith('/login');
  });

  describe('when the page has a Buy Gold section', () => {
    let scrollIntoView: jest.Mock;
    beforeEach(() => {
      scrollIntoView = jest.fn();
      const section = document.createElement('section');
      section.id = 'buy-gold';
      section.tabIndex = -1;
      section.scrollIntoView = scrollIntoView;
      document.body.appendChild(section);
    });
    afterEach(() => document.getElementById('buy-gold')?.remove());

    it('scrolls smoothly unless the visitor prefers reduced motion', () => {
      installMatchMedia(false);
      renderWithProviders(<HeroBlock props={parseHeroProps({})} context={context} />);

      fireEvent.click(screen.getByRole('button', { name: 'Buy Gold' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it.each([
      ['a signed-in customer', undefined],
      ['a signed-out visitor', null],
    ])('scrolls down to it for %s instead of opening a dialog', (_label, user) => {
      renderWithProviders(<HeroBlock props={parseHeroProps({})} context={context} />, { user });

      fireEvent.click(screen.getByRole('button', { name: 'Buy Gold' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
      expect(document.activeElement?.id).toBe('buy-gold');
      expect(screen.queryByText('buy gold card')).toBeNull();
      expect(push).not.toHaveBeenCalled();
    });

    it('scrolls from the Buy quick action too', () => {
      renderWithProviders(<QuickActionsBlock props={{ showDelivery: true }} context={context} />);

      fireEvent.click(screen.getByRole('button', { name: /Buy gold/ }));

      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it('opens the purchase card for a signed-in customer', () => {
    renderWithProviders(<HeroBlock props={parseHeroProps({})} context={context} />);

    fireEvent.click(screen.getByRole('button', { name: 'Buy Gold' }));

    expect(screen.getByText('buy gold card')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('hides the call to action when trading is switched off', () => {
    renderWithProviders(<HeroBlock props={parseHeroProps({})} context={context} />, {
      preloaded: tenant({ trading: false }),
    });

    expect(screen.queryByRole('button', { name: 'Buy Gold' })).toBeNull();
  });
});

describe('LiveRateBlock', () => {
  it('shows buy and sell prices with a live badge', () => {
    mockedLiveRate.mockReturnValue({
      data: rate,
      isLoading: false,
      isConnected: true,
      status: 'open',
    });
    renderWithProviders(<LiveRateBlock />);

    expect(screen.getByText('Buy price')).toBeTruthy();
    expect(screen.getByText(/7,650\.50/)).toBeTruthy();
    expect(screen.getByText(/7,400\.00/)).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('labels a polled rate as a snapshot', () => {
    mockedLiveRate.mockReturnValue({
      data: rate,
      isLoading: false,
      isConnected: false,
      status: 'closed',
    });
    renderWithProviders(<LiveRateBlock />);

    expect(screen.getByText('Snapshot')).toBeTruthy();
  });

  it('marks a missing bid as unavailable instead of showing zero', () => {
    mockedLiveRate.mockReturnValue({
      data: { ...rate, bidPerGramInr: null },
      isLoading: false,
      isConnected: true,
      status: 'open',
    });
    renderWithProviders(<LiveRateBlock />);

    expect(screen.getByText('Unavailable')).toBeTruthy();
  });

  it('shows a loading state, then an unavailable message when there is no rate', () => {
    mockedLiveRate.mockReturnValue({
      data: null,
      isLoading: true,
      isConnected: false,
      status: 'connecting',
    });
    const { unmount } = renderWithProviders(<LiveRateBlock />);
    expect(screen.getByRole('status', { name: 'Loading live rate' })).toBeTruthy();
    unmount();

    mockedLiveRate.mockReturnValue({
      data: null,
      isLoading: false,
      isConnected: false,
      status: 'error',
    });
    renderWithProviders(<LiveRateBlock />);
    expect(screen.getByText(/live rate is unavailable/i)).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
  });
});

describe('QuickActionsBlock', () => {
  const props = { showDelivery: true };

  it('offers Buy and Delivery', () => {
    renderWithProviders(<QuickActionsBlock props={props} context={context} />);

    expect(screen.getByRole('navigation', { name: 'Quick actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Buy gold/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Delivery/ }).getAttribute('href')).toBe(
      '/vault/redemptions'
    );
  });

  it('describes each action like the essentials cards do', () => {
    renderWithProviders(<QuickActionsBlock props={props} context={context} />);

    expect(screen.getByText('Buy 24K gold at the live rate.')).toBeTruthy();
    expect(screen.getByText('Redeem your gold as coins.')).toBeTruthy();
  });

  it('respects showDelivery', () => {
    renderWithProviders(<QuickActionsBlock props={{ showDelivery: false }} context={context} />);

    expect(screen.queryByRole('link', { name: /Delivery/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Buy gold/ })).toBeTruthy();
  });

  it('hides actions for modules the tenant has switched off', () => {
    renderWithProviders(<QuickActionsBlock props={props} context={context} />, {
      preloaded: tenant({ trading: false }),
    });

    expect(screen.queryByRole('button', { name: /Buy gold/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Delivery/ })).toBeTruthy();
  });

  it('renders nothing when every action is unavailable', () => {
    const { container } = renderWithProviders(
      <QuickActionsBlock props={props} context={context} />,
      { preloaded: tenant({ trading: false, vault: false }) }
    );

    expect(container.querySelector('nav')).toBeNull();
  });

  it('starts a purchase from Buy', () => {
    renderWithProviders(<QuickActionsBlock props={props} context={context} />);

    fireEvent.click(screen.getByRole('button', { name: /Buy gold/ }));

    expect(screen.getByText('buy gold card')).toBeTruthy();
  });

  it('asks a signed-out visitor to sign in before buying', () => {
    renderWithProviders(<QuickActionsBlock props={props} context={context} />, { user: null });

    fireEvent.click(screen.getByRole('button', { name: /Buy gold/ }));

    expect(push).toHaveBeenCalledWith('/login');
  });
});

describe('PortfolioSummaryBlock', () => {
  const base = {
    portfolio: null,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    isAuthenticated: true,
    isMock: false,
    refetch: jest.fn(),
  };

  it('shows the signed-in customer\'s balance from the portfolio state', () => {
    mockedPortfolio.mockReturnValue({
      ...base,
      portfolio: {
        balanceGrams: 2.5,
        currentValuationInr: 18500,
        liveRate: { bid: 7400, ask: 7500, lastHigh: null, lastLow: null },
        fetchedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    renderWithProviders(<PortfolioSummaryBlock />);

    expect(screen.getByRole('heading', { name: 'My portfolio' })).toBeTruthy();
    expect(screen.getByText('2.5000 g')).toBeTruthy();
    expect(screen.getByText(/18,500/)).toBeTruthy();
  });

  it('starts the buy flow from the Buy Gold button without leaving the page', () => {
    mockedPortfolio.mockReturnValue({
      ...base,
      portfolio: {
        balanceGrams: 0,
        currentValuationInr: 0,
        liveRate: { bid: 7400, ask: 7500, lastHigh: null, lastLow: null },
        fetchedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    const section = document.createElement('section');
    section.id = 'buy-gold';
    section.tabIndex = -1;
    const scrollIntoView = jest.fn();
    section.scrollIntoView = scrollIntoView;
    document.body.appendChild(section);
    renderWithProviders(<PortfolioSummaryBlock />);

    fireEvent.click(screen.getByRole('button', { name: /Buy Gold/ }));
    section.remove();

    expect(scrollIntoView).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Buy Gold/ })).toBeNull();
  });

  it('hides the Buy Gold button when trading is switched off', () => {
    mockedPortfolio.mockReturnValue({
      ...base,
      portfolio: {
        balanceGrams: 1,
        currentValuationInr: 7400,
        liveRate: { bid: 7400, ask: 7500, lastHigh: null, lastLow: null },
        fetchedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    renderWithProviders(<PortfolioSummaryBlock />, { preloaded: tenant({ trading: false }) });

    // Without a buy flow on this page the card falls back to its plain link.
    expect(screen.queryByRole('button', { name: /Buy/ })).toBeNull();
  });

  it('invites a signed-out visitor to sign in', () => {
    mockedPortfolio.mockReturnValue({ ...base, isAuthenticated: false });
    renderWithProviders(<PortfolioSummaryBlock />, { user: null });

    // The session is only treated as signed out once mount effects have run.
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(push).toHaveBeenCalledWith('/login');
  });

  it('shows a loading state while the portfolio loads', () => {
    mockedPortfolio.mockReturnValue({ ...base, isLoading: true, isFetching: true });
    renderWithProviders(<PortfolioSummaryBlock />);

    expect(screen.getByRole('status', { name: 'Loading your portfolio' })).toBeTruthy();
  });

  it('shows the reason and a retry when the portfolio fails', () => {
    const refetch = jest.fn();
    mockedPortfolio.mockReturnValue({
      ...base,
      isError: true,
      error: 'Server unavailable',
      refetch,
    });
    renderWithProviders(<PortfolioSummaryBlock />);

    expect(screen.getByText('Server unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders nothing when the tenant has no vault', () => {
    mockedPortfolio.mockReturnValue(base);
    const { container } = renderWithProviders(<PortfolioSummaryBlock />, {
      preloaded: tenant({ vault: false }),
    });

    expect(container.querySelector('section')).toBeNull();
  });
});
