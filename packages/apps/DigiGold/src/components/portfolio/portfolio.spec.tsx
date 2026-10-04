import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, render, screen } from '@testing-library/react';
import { VaultBalanceCard } from './VaultBalanceCard/VaultBalanceCard';
import { LiveRatePanel } from './LiveRatePanel/LiveRatePanel';
import {
  VaultErrorState,
  VaultLoadingState,
  VaultUnauthenticatedState,
} from './VaultStates/VaultStates';
import type { Portfolio } from '@/features/portfolio/portfolio.types';

// These are the leaf components, so they render with plain props — no store, query client or
// router doubles. The state *selection* between them lives in VaultPortfolio and is covered by
// the page's own rendering.
const PORTFOLIO: Portfolio = {
  balanceGrams: 24.5812,
  currentValuationInr: 175031.44,
  liveRate: { bid: 7120.83, ask: 7137.5, lastHigh: 7300, lastLow: 7050 },
  fetchedAt: '2026-09-26T10:30:00.000Z',
};

const NO_RATE: Portfolio = {
  ...PORTFOLIO,
  liveRate: { bid: null, ask: null, lastHigh: null, lastLow: null },
};

afterEach(() => {
  cleanup();
});

describe('VaultBalanceCard', () => {
  it('shows the server valuation and the ledger balance', () => {
    render(<VaultBalanceCard portfolio={PORTFOLIO} />);

    // current_valuation_inr, formatted as INR with Indian digit grouping.
    expect(screen.getByText('₹1,75,031')).toBeTruthy();
    // balance_grams at 4dp ledger precision.
    expect(screen.getByText('24.5812 g')).toBeTruthy();
  });

  it('surfaces a zero balance as an invitation to buy, not a broken reading', () => {
    render(<VaultBalanceCard portfolio={{ ...PORTFOLIO, balanceGrams: 0 }} />);

    expect(screen.getByText('0.0000 g')).toBeTruthy();
    expect(screen.getByText(/start your first purchase today/i)).toBeTruthy();
    // Nothing to passbook yet, so the secondary action is withheld.
    expect(screen.queryByText('View Passbook')).toBeNull();
  });

  it('links through to buying without offering an unavailable passbook page', () => {
    render(<VaultBalanceCard portfolio={PORTFOLIO} />);

    expect(
      screen.getByText('Buy More Gold').closest('a')?.getAttribute('href'),
    ).toBe('/home');
    expect(screen.queryByText('View Passbook')).toBeNull();
  });

  it('does not value a positive holding at zero when the server has no bid', () => {
    render(
      <VaultBalanceCard portfolio={{ ...NO_RATE, currentValuationInr: 0 }} />,
    );

    expect(screen.getByText('Valuation unavailable')).toBeTruthy();
    expect(screen.getByText('24.5812 g')).toBeTruthy();
    expect(screen.queryByText('₹0')).toBeNull();
  });

  it('keeps a confirmed valuation when the rate snapshot is unavailable', () => {
    render(<VaultBalanceCard portfolio={NO_RATE} />);

    expect(screen.getByText('₹1,75,031')).toBeTruthy();
    expect(screen.getByText(/Holdings updated/)).toBeTruthy();
  });
});

describe('LiveRatePanel', () => {
  it('renders the live bid and ask with two-decimal precision', () => {
    render(
      <LiveRatePanel
        liveRate={PORTFOLIO.liveRate}
        balanceGrams={PORTFOLIO.balanceGrams}
        isStreamConnected
        fetchedAt={PORTFOLIO.fetchedAt}
      />,
    );

    expect(screen.getByText(/₹7,120\.83/)).toBeTruthy();
    expect(screen.getByText(/₹7,137\.50/)).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    // Paise matter here: the spread is only a few rupees on a ~₹7,100 rate.
    expect(screen.getByText('₹16.67/g')).toBeTruthy();
  });

  it('hides a missing rate instead of rendering ₹0 as a real bid', () => {
    render(
      <LiveRatePanel
        liveRate={NO_RATE.liveRate}
        balanceGrams={PORTFOLIO.balanceGrams}
        isStreamConnected={false}
        fetchedAt={PORTFOLIO.fetchedAt}
      />,
    );

    expect(screen.queryByText(/₹0/)).toBeNull();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.getByText(/rate feed is unavailable/i)).toBeTruthy();
    // Falls back to the snapshot badge when no stream is feeding the rate.
    expect(screen.getByText('Snapshot')).toBeTruthy();
  });

  it('states that the valuation uses the raw bid with no margin', () => {
    render(
      <LiveRatePanel
        liveRate={PORTFOLIO.liveRate}
        balanceGrams={PORTFOLIO.balanceGrams}
        isStreamConnected
        fetchedAt={PORTFOLIO.fetchedAt}
      />,
    );

    expect(screen.getByText(/raw bid with no tenant margin/i)).toBeTruthy();
    expect(screen.getByText('24.5812 g held')).toBeTruthy();
  });

  it('does not present the raw ask as the purchase price', () => {
    render(
      <LiveRatePanel
        liveRate={PORTFOLIO.liveRate}
        balanceGrams={PORTFOLIO.balanceGrams}
        isStreamConnected
        fetchedAt={PORTFOLIO.fetchedAt}
      />,
    );

    // BuyGold charges ask + margin + GST, so "what you pay" here would understate it.
    expect(screen.queryByText(/what you pay/i)).toBeNull();
    expect(screen.getByText(/margin and GST on top of\s+the ask/i)).toBeTruthy();
  });
});

describe('VaultStates', () => {
  it('announces the loading state to assistive tech', () => {
    render(<VaultLoadingState />);

    expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
      'Loading your vault',
    );
    expect(screen.queryByText('Total Vault Value')).toBeNull();
  });

  it('invites a signed-out visitor to sign in', () => {
    const onSignIn = jest.fn();
    render(<VaultUnauthenticatedState onSignIn={onSignIn} />);

    screen.getByText('Sign in to view your vault').click();
    expect(onSignIn).toHaveBeenCalled();
  });

  it('surfaces the API error message and re-fires the request on retry', () => {
    const onRetry = jest.fn();
    render(
      <VaultErrorState
        message="Request failed with status code 500"
        onRetry={onRetry}
        isRetrying={false}
      />,
    );

    expect(
      screen.getByText('Request failed with status code 500'),
    ).toBeTruthy();
    screen.getByText('Try again').click();
    expect(onRetry).toHaveBeenCalled();
  });
});
