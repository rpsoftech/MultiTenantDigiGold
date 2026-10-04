import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { apiClient } from '../../lib/api/client';
import { portfolioService } from './portfolio.service';

const testEnv = (
  globalThis as unknown as {
    process: { env: Record<string, string | undefined> };
  }
).process.env;

describe('portfolioService', () => {
  const originalUseMockPortfolio = testEnv.NEXT_PUBLIC_USE_MOCK_PORTFOLIO;

  beforeEach(() => {
    testEnv.NEXT_PUBLIC_USE_MOCK_PORTFOLIO = 'false';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalUseMockPortfolio === undefined) {
      delete testEnv.NEXT_PUBLIC_USE_MOCK_PORTFOLIO;
    } else {
      testEnv.NEXT_PUBLIC_USE_MOCK_PORTFOLIO = originalUseMockPortfolio;
    }
  });

  it('returns sample holdings without requesting the API when mock mode is enabled', async () => {
    testEnv.NEXT_PUBLIC_USE_MOCK_PORTFOLIO = 'true';
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const getSpy = jest
      .spyOn(apiClient, 'get')
      .mockRejectedValue(new Error('Mock portfolio must not request the API'));

    const portfolio = await portfolioService.getPortfolio();

    expect(getSpy).not.toHaveBeenCalled();
    expect(portfolio.balanceGrams).toBe(24.5812);
    expect(portfolio.currentValuationInr).toBe(175038.55);
    expect(portfolio.liveRate.bid).toBe(7120.83);
    expect(portfolio.liveRate.ask).toBe(7137.5);
    expect(Number.isFinite(Date.parse(portfolio.fetchedAt))).toBe(true);
  });

  it('maps the MainServer portfolio payload onto the view model', async () => {
    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        balance_grams: 24.5812,
        current_valuation_inr: 175031.44,
        live_rate: { bid: 7120.83, ask: 7137.5 },
      },
    });

    const portfolio = await portfolioService.getPortfolio();

    expect(getSpy).toHaveBeenCalledWith('/user/portfolio');
    expect(portfolio.balanceGrams).toBe(24.5812);
    expect(portfolio.currentValuationInr).toBe(175031.44);
    expect(portfolio.liveRate.bid).toBe(7120.83);
    expect(portfolio.liveRate.ask).toBe(7137.5);
  });

  it('nulls out bid/ask when the rate feed has no usable values', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        balance_grams: 5,
        current_valuation_inr: 35604,
        // A missing key and a sentinel 0 are indistinguishable on the wire, and neither is
        // a real gold price — both must render as unavailable rather than "₹0".
        live_rate: { bid: 0 },
      },
    });

    const portfolio = await portfolioService.getPortfolio();

    expect(portfolio.liveRate.bid).toBeNull();
    expect(portfolio.liveRate.ask).toBeNull();
  });

  it('tolerates a null live_rate from an empty rate hub', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        balance_grams: 0,
        current_valuation_inr: 0,
        live_rate: null,
      },
    });

    const portfolio = await portfolioService.getPortfolio();

    expect(portfolio.balanceGrams).toBe(0);
    expect(portfolio.currentValuationInr).toBe(0);
    expect(portfolio.liveRate).toEqual({
      bid: null,
      ask: null,
      lastHigh: null,
      lastLow: null,
    });
  });

  it('clamps a negative ledger balance instead of rendering it as a holding', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        balance_grams: -3.5,
        current_valuation_inr: -100,
        live_rate: null,
      },
    });

    const portfolio = await portfolioService.getPortfolio();

    expect(portfolio.balanceGrams).toBe(0);
    expect(portfolio.currentValuationInr).toBe(0);
  });
});
