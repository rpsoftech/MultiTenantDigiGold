import type { AdminTokens } from '@/lib/api/admin-tokens';

export type AdminLoginPayload = {
  username: string;
  password: string;
};

export type AdminLoginResult = {
  temp_token: string;
  // true: the admin already has an authenticator, so skip setup and ask for a code.
  // Absent on older servers; the client then asks setup, which answers 409 if enrolled.
  totp_enabled?: boolean;
};

export type AdminTotpSetupPayload = {
  temp_token: string;
};

export type AdminTotpSetupResult = {
  otpauth_uri: string;
};

export type AdminTotpVerifyPayload = AdminTotpSetupPayload & {
  code: string;
};

export type AdminTokenPair = AdminTokens;

export type AdminProfile = {
  userId: string;
  name: string;
  email: string;
  phone?: string;
};

export type UpdateAdminProfilePayload = {
  name: string;
  email: string;
  phone?: string;
};

export type UpdateAdminPasswordPayload = {
  currentPassword: string;
  newPassword: string;
};
