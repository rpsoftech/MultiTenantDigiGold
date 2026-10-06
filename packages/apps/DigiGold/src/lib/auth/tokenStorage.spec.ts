import {
  clearRegistrationToken,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getRegistrationToken,
  setRegistrationToken,
  setTokens,
} from './tokenStorage';

describe('tokenStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('access and refresh tokens', () => {
    it('returns null when nothing is stored', () => {
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('stores both tokens in localStorage', () => {
      setTokens({ accessToken: 'access', refreshToken: 'refresh' });

      expect(getAccessToken()).toBe('access');
      expect(getRefreshToken()).toBe('refresh');
      expect(window.localStorage.getItem('access_token')).toBe('access');
    });

    it('only overwrites the tokens that are provided', () => {
      setTokens({ accessToken: 'access', refreshToken: 'refresh' });

      setTokens({ accessToken: 'newer' });

      expect(getAccessToken()).toBe('newer');
      expect(getRefreshToken()).toBe('refresh');
    });

    it('ignores empty or missing tokens', () => {
      setTokens({});
      setTokens({ accessToken: '', refreshToken: '' });

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('clears both tokens', () => {
      setTokens({ accessToken: 'access', refreshToken: 'refresh' });

      clearTokens();

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe('registration token', () => {
    it('lives in sessionStorage, not localStorage', () => {
      setRegistrationToken('reg');

      expect(getRegistrationToken()).toBe('reg');
      expect(window.sessionStorage.getItem('registration_token')).toBe('reg');
      expect(window.localStorage.getItem('registration_token')).toBeNull();
    });

    it('is cleared independently of the access tokens', () => {
      setTokens({ accessToken: 'access' });
      setRegistrationToken('reg');

      clearRegistrationToken();

      expect(getRegistrationToken()).toBeNull();
      expect(getAccessToken()).toBe('access');
    });

    it('is not removed by clearTokens', () => {
      setRegistrationToken('reg');

      clearTokens();

      expect(getRegistrationToken()).toBe('reg');
    });
  });
});
