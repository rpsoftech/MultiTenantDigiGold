import { describe, expect, it } from '@jest/globals';
import { parseRateFrame } from './market.utils';
import { applyDefaultTenantPricing } from './tenantPricing';

describe('parseRateFrame', () => {
  it.each([
    '{"bid":7000,"ask":7100,"last-high":7200,"last-low":6900}',
    '{"last-high":7200,"timestamp":1790784000,"bid":7000,"ask":7100}',
    'data: {"last-low":6900,"bid":7000,"ask":7100}\n\n',
    'id: 42\nretry: 3000\ndata: {"bid":7000,\ndata: "ask":7100}\n\n',
  ])('prices off ask regardless of field order or SSE metadata: %s', (frame) => {
    const parsed = parseRateFrame(frame);
    expect(parsed?.mcxBaseRateInr).toBe(7100);
    expect(parsed?.finalRatePerGramInr).toBe(applyDefaultTenantPricing(7100).finalRatePerGramInr);
  });

  it.each([
    '7120.83',
    '  7120.83\n',
    'data: 7120.83\n\n',
    'data:7120.83\r\n\r\n',
  ])('preserves legacy scalar compatibility: %s', (frame) => {
    expect(parseRateFrame(frame)?.mcxBaseRateInr).toBe(7120.83);
  });

  it.each([
    undefined,
    null,
    '',
    '  ',
    '0',
    '-12',
    'NaN',
    'Infinity',
    '1e999',
    'true',
    'null',
    '[7100]',
    '"7100"',
    'error 500: rate unavailable',
    'id: 7100\nretry: 3000\n\n',
    '{"timestamp":1790784000,"last-high":7200,"last-low":6900}',
    '{"bid":7000}',
    '{"ask":0,"bid":7000}',
    '{"ask":-1,"bid":7000}',
    '{"ask":null,"bid":7000}',
    '{"ask":"7100","bid":7000}',
    '{"ask":true,"bid":7000}',
    '{"ask":1e999,"bid":7000}',
    '{"ask":7100,',
    'data: error 503\n\n',
  ])('rejects invalid or missing purchase prices: %s', (frame) => {
    expect(parseRateFrame(frame)).toBeNull();
  });

  it.each([
    '{"bid":7000,"ask":7100,"last-high":7200,"last-low":6900}',
    'id: 42\ndata: {"last-high":7200,\ndata: "ask":7100,"bid":7000}\n\n',
  ])('preserves both raw quote sides: %s', (frame) => {
    expect(parseRateFrame(frame)).toMatchObject({ bidPerGramInr: 7000, askPerGramInr: 7100 });
  });

  it.each([
    '{"ask":7100}',
    '{"ask":7100,"bid":0}',
    '{"ask":7100,"bid":-1}',
    '{"ask":7100,"bid":null}',
    '{"ask":7100,"bid":true}',
    '{"ask":7100,"bid":"7000"}',
    '{"ask":7100,"bid":1e999}',
  ])('keeps a missing or invalid bid unavailable: %s', (frame) => {
    expect(parseRateFrame(frame)).toMatchObject({ bidPerGramInr: null, askPerGramInr: 7100 });
  });

  it('does not invent bid/ask sides for legacy scalar ticks', () => {
    expect(parseRateFrame('data: 7120.83\n\n')).toMatchObject({
      bidPerGramInr: null,
      askPerGramInr: null,
    });
  });
});
