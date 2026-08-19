export type KycStatus = 'not_started' | 'pending' | 'verified' | 'rejected';

// NOTE: candidate for @digigold/core — MainServer's JWT payload should mirror this shape
// once it's built and importable.
export type SessionUser = {
  userId: string;
  mobileNumber: string;
  isNewUser: boolean;
  kycStatus: KycStatus;
};
