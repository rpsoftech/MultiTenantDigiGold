import { describe, expect, it } from '@jest/globals';

import { normalizeApiBaseURL } from './client';

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
