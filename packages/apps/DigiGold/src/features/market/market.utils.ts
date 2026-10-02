// REST snapshots and EventSource messages contain the same rate JSON. The purchase
// calculator needs ask; bid and the day's high/low are not purchase prices.
// Accept legacy scalar ticks too, including the mock stream's full SSE frames.
type MarketQuote = {
  pricePerGramInr: number;
  bidPerGramInr: number | null;
  askPerGramInr: number | null;
};

function validPrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function parseRateFrameToQuote(
  raw: string | null | undefined,
): MarketQuote | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  const dataLines = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''));
  const payload = dataLines.length > 0 ? dataLines.join('\n') : raw.trim();

  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed === 'number') {
      const price = validPrice(parsed);
      // A legacy scalar supplies a purchase price but no explicit market sides.
      return price === null
        ? null
        : {
            pricePerGramInr: price,
            bidPerGramInr: null,
            askPerGramInr: null,
          };
    }
    if (parsed === null || typeof parsed !== 'object' || !('ask' in parsed)) {
      return null;
    }

    const ask = validPrice(parsed.ask);
    if (ask === null) return null;

    return {
      pricePerGramInr: ask,
      bidPerGramInr: 'bid' in parsed ? validPrice(parsed.bid) : null,
      askPerGramInr: ask,
    };
  } catch {
    return null;
  }
}

export function parseRateFrameToPrice(
  raw: string | null | undefined,
): number | null {
  return parseRateFrameToQuote(raw)?.pricePerGramInr ?? null;
}
