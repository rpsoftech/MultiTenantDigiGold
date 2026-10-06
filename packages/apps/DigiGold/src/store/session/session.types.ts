export type KycStatus = 'not_started' | 'pending' | 'verified' | 'rejected';

export type SessionRole = 'customer' | 'admin';

// NOTE: candidate for @digigold/core — MainServer's JWT payload should mirror this shape
// once it's built and importable.
export type SessionUser = {
  userId: string;
  role: SessionRole;
  mobileNumber?: string; // customer sessions
  email?: string; // admin sessions
  name?: string; // admin sessions
  adminRole?: string; // admin sessions: MainServer role, e.g. super_admin, manager, custom
  isNewUser: boolean;
  kycStatus: KycStatus;
};
