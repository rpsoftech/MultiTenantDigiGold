// NOTE: candidate for @digigold/core once MainServer's live-rate WebSocket contract is
// finalized — this mirrors the expected tick payload shape.

export type MarketRate = {
  pricePerGramInr: number;
  purityLabel: string; // e.g. "24K • 99.99%"
  updatedAt: string; // ISO string
};
