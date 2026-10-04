export type MarketRate = {
  // Client-side estimate of the tenant-priced rate (raw MCX ask + a hardcoded default
  // margin/GST — see features/market/tenantPricing.ts). NOT guaranteed to match what
  // /trade/buy/initiate actually charges if this tenant's real margin config differs from
  // the platform default; MainServer doesn't expose the real one publicly.
  pricePerGramInr: number;
  mcxBaseRateInr: number;
  marginAppliedInr: number;
  gstAppliedInr: number;
  // Raw MCX quote sides, untouched by the margin/GST estimate above — what the vault's
  // live-rate panel shows. bid is null for a legacy scalar frame, which carries no sides.
  bidPerGramInr: number | null;
  askPerGramInr: number | null;
  purityLabel: string; // e.g. "24K • 99.99%"
  updatedAt: string; // ISO string
};

// MainServer's rate feed carries bid/ask quotes but does not carry purity yet.
export const MARKET_PURITY_LABEL = '24K • 99.99%';

export type MarketConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';
