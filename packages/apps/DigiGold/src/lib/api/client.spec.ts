import { describe, expect, it } from '@jest/globals';

import {
  describeApiError,
  isNormalizedApiError,
  normalizeApiBaseURL,
} from './client';

describe('normalizeApiBaseURL', () => {
  it('leaves an undefined base URL unset', () => {
    expect(normalizeApiBaseURL(undefined)).toBeUndefined();
  });

  it('adds the backend API version when the origin is provided', () => {
    expect(normalizeApiBaseURL('http://localhost:8080')).toBe(
      'http://localhost:8080/api/v1',
    );
  });

  it('adds only the version when the API root is provided', () => {
    expect(normalizeApiBaseURL('http://localhost:8080/api')).toBe(
      'http://localhost:8080/api/v1',
    );
  });

  it('does not duplicate the API version when it is already configured', () => {
    expect(normalizeApiBaseURL('http://localhost:8080/api/v1')).toBe(
      'http://localhost:8080/api/v1',
    );
  });

  it('normalizes trailing slashes before checking the API version', () => {
    expect(normalizeApiBaseURL('http://localhost:8080/api/v1/')).toBe(
      'http://localhost:8080/api/v1',
    );
  });
});

describe('isNormalizedApiError', () => {
  it('recognises the plain object the response interceptor rejects with', () => {
    // Deliberately not an Error instance — that is exactly what normalizeApiError produces.
    expect(
      isNormalizedApiError({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        status: null,
      }),
    ).toBe(true);
  });

  it('rejects values that are not API errors', () => {
    expect(isNormalizedApiError(new Error('boom'))).toBe(false);
    expect(isNormalizedApiError(null)).toBe(false);
    expect(isNormalizedApiError('nope')).toBe(false);
  });
});

describe('describeApiError', () => {
  it('replaces the developer-facing network error with plain language', () => {
    expect(
      describeApiError({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        status: null,
      }),
    ).toBe("Can't reach the server. Check your connection and try again.");
  });

  it('distinguishes a timeout from a dead connection', () => {
    expect(
      describeApiError({
        message: 'timeout of 15000ms exceeded',
        code: 'ECONNABORTED',
        status: null,
      }),
    ).toBe('The server took too long to respond. Please try again.');
  });

  it('tells the customer their session expired on a 401', () => {
    expect(
      describeApiError({
        message: 'unauthorized',
        code: 'ERR_BAD_REQUEST',
        status: 401,
      }),
    ).toBe('Your session has expired. Please sign in again.');
  });

  it('does not blame the customer for a 5xx', () => {
    expect(
      describeApiError({
        message: 'boom',
        code: 'ERR_BAD_RESPONSE',
        status: 503,
      }),
    ).toBe('The server is having trouble right now. Please try again shortly.');
  });

  it('passes a server-supplied client-error message straight through', () => {
    expect(
      describeApiError({
        message: 'KYC Verification is required for trades above 50,000 INR',
        code: 'ERR_BAD_REQUEST',
        status: 400,
      }),
    ).toBe('KYC Verification is required for trades above 50,000 INR');
  });

  it('still reads a genuine Error, and returns null for nothing useful', () => {
    expect(describeApiError(new Error('kaboom'))).toBe('kaboom');
    expect(describeApiError(undefined)).toBeNull();
  });
});
