export type MarketRate = {
  pricePerGramInr: number;
  purityLabel: string; // e.g. "24K • 99.99%"
  updatedAt: string; // ISO string
};

// MainServer's rate feed doesn't carry purity yet, only a numeric price.
// TODO: confirm with backend once /rates/last-rate and /rates/stream expose it.
export const MARKET_PURITY_LABEL = '24K • 99.99%';

export type MarketConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';
