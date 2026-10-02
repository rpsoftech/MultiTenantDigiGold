import type { AdminTokens } from '@/lib/api/admin-tokens';

export type AdminLoginPayload = {
  username: string;
  password: string;
};

export type AdminLoginResult = {
  temp_token: string;
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
