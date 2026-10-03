import { makeStore } from '@/store';
import type { MarketRate } from '@/features/market/market.types';
import {
  rateReceived,
  selectMarketRate,
  selectMarketStatus,
  selectPreviousMarketRate,
  statusChanged,
} from './market.slice';

const rate = (price: number): MarketRate => ({
  pricePerGramInr: price,
  mcxBaseRateInr: price - 313,
  marginAppliedInr: 100,
  gstAppliedInr: 213,
  purityLabel: '24K',
  updatedAt: '2026-10-01T10:00:00Z',
});

describe('market slice', () => {
  it('starts with no rate and a connecting status', () => {
    const store = makeStore();

    expect(selectMarketRate(store.getState())).toBeNull();
    expect(selectPreviousMarketRate(store.getState())).toBeNull();
    expect(selectMarketStatus(store.getState())).toBe('connecting');
  });

  it('stores the first rate with no previous one', () => {
    const store = makeStore();

    store.dispatch(rateReceived(rate(7000)));

    expect(selectMarketRate(store.getState())?.pricePerGramInr).toBe(7000);
    expect(selectPreviousMarketRate(store.getState())).toBeNull();
  });

  it('keeps the rate it replaces so the UI can show direction', () => {
    const store = makeStore();

    store.dispatch(rateReceived(rate(7000)));
    store.dispatch(rateReceived(rate(7050)));
    store.dispatch(rateReceived(rate(7040)));

    expect(selectMarketRate(store.getState())?.pricePerGramInr).toBe(7040);
    expect(selectPreviousMarketRate(store.getState())?.pricePerGramInr).toBe(7050);
  });

  it('tracks the connection status separately from the rate', () => {
    const store = makeStore();
    store.dispatch(rateReceived(rate(7000)));

    store.dispatch(statusChanged('open'));
    expect(selectMarketStatus(store.getState())).toBe('open');

    store.dispatch(statusChanged('error'));
    expect(selectMarketStatus(store.getState())).toBe('error');
    expect(selectMarketRate(store.getState())?.pricePerGramInr).toBe(7000);
  });
});
