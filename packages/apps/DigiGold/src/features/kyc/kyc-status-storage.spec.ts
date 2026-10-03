import { getStoredKycStatus, setStoredKycStatus } from './kyc-status-storage';

describe('kyc status storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to not_started when nothing is stored', () => {
    expect(getStoredKycStatus('user-1')).toBe('not_started');
  });

  it('round-trips a status per user', () => {
    setStoredKycStatus('user-1', 'pending');
    setStoredKycStatus('user-2', 'verified');

    expect(getStoredKycStatus('user-1')).toBe('pending');
    expect(getStoredKycStatus('user-2')).toBe('verified');
  });

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem('kyc_status:user-1', 'approved-by-magic');
    expect(getStoredKycStatus('user-1')).toBe('not_started');
  });

  it('does nothing for an empty user id', () => {
    setStoredKycStatus('', 'pending');
    expect(getStoredKycStatus('')).toBe('not_started');
    expect(window.localStorage.length).toBe(0);
  });

  it('survives storage that throws', () => {
    const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getStoredKycStatus('user-1')).toBe('not_started');
    expect(() => setStoredKycStatus('user-1', 'pending')).not.toThrow();

    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});
