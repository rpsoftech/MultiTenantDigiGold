import { describe, expect, it } from '@jest/globals';
import { decodeJwtPayload, isJwtExpired } from './jwt';

function segment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf-8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function token(claims: unknown): string {
  return `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment(claims)}.signature`;
}

describe('decodeJwtPayload', () => {
  it('reads the payload claims', () => {
    expect(decodeJwtPayload(token({ user_uuid: 'u-1', exp: 1 }))).toEqual({
      user_uuid: 'u-1',
      exp: 1,
    });
  });

  it('decodes non-ASCII claims as UTF-8 rather than one character per byte', () => {
    expect(
      decodeJwtPayload<{ name: string }>(token({ name: 'Zoë शर्मा' }))?.name,
    ).toBe('Zoë शर्मा');
  });

  it.each([
    'not-a-jwt',
    'a.b',
    'a.b.c.d',
    `${segment({})}.${segment({ a: 1 })}.sig with spaces`,
    `${segment({})}.${segment('just a string')}.sig`,
    `${segment({})}.!!!.sig`,
  ])('returns null for malformed token %p', (value) => {
    expect(decodeJwtPayload(value)).toBeNull();
  });
});

describe('isJwtExpired', () => {
  it('compares exp (seconds) to the current time', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isJwtExpired(token({ exp: now - 10 }))).toBe(true);
    expect(isJwtExpired(token({ exp: now + 600 }))).toBe(false);
  });

  it('treats a token without exp as not expired (the server decides)', () => {
    expect(isJwtExpired(token({}))).toBe(false);
  });
});
