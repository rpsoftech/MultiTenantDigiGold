export type MarketRate = {
  pricePerGramInr: number;
  bidPerGramInr?: number | null;
  askPerGramInr?: number | null;
  purityLabel: string; // e.g. "24K • 99.99%"
  updatedAt: string; // ISO string
};

// MainServer's rate feed carries bid/ask quotes but does not carry purity yet.
export const MARKET_PURITY_LABEL = '24K • 99.99%';

export type MarketConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';
