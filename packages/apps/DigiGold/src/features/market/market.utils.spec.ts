import { parseRateFrame } from './market.utils';
import { applyDefaultTenantPricing } from './tenantPricing';

describe('parseRateFrame', () => {
  it.each([[null], [undefined], ['']])('returns null for %p', (raw) => {
    expect(parseRateFrame(raw)).toBeNull();
  });

  it('reads the ask price from the JSON frame MainServer sends', () => {
    const frame = JSON.stringify({ bid: 6950, ask: 7000 });

    expect(parseRateFrame(frame)).toEqual(applyDefaultTenantPricing(7000));
  });

  it('uses the ask even though bid comes first in the frame', () => {
    const frame = '{"bid":1111,"ask":7000,"timestamp":"2026-10-01"}';

    expect(parseRateFrame(frame)?.mcxBaseRateInr).toBe(7000);
  });

  it('accepts a bare number, as the mock stream sends', () => {
    expect(parseRateFrame('7120.83')).toEqual(applyDefaultTenantPricing(7120.83));
  });

  it('accepts an SSE style data line', () => {
    expect(parseRateFrame('data: 7120.5\n\n')).toEqual(applyDefaultTenantPricing(7120.5));
  });

  it.each([['hello'], ['data: n/a'], ['{}'], ['{"ask":"abc"}']])(
    'returns null when there is no price in %p',
    (raw) => {
      expect(parseRateFrame(raw)).toBeNull();
    },
  );

  it.each([['0'], ['-5'], ['-0.01']])('rejects the non-positive price %p', (raw) => {
    expect(parseRateFrame(raw)).toBeNull();
  });

  it('rejects a zero or negative ask in a JSON frame', () => {
    expect(parseRateFrame('{"ask":0}')).toBeNull();
    expect(parseRateFrame('{"ask":-100}')).toBeNull();
  });
});
