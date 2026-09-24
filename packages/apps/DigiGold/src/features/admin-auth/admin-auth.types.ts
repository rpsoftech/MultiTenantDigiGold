import type { SessionUser } from '@/store/session/session.types';

// NOTE: candidate for @digigold/core once MainServer exposes admin auth endpoints — these
// mirror the expected request/response shapes for admin email/password login.

export type AdminLoginPayload = {
  email: string;
  password: string;
};

export type AdminLoginResult = {
  user: SessionUser;
};

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
