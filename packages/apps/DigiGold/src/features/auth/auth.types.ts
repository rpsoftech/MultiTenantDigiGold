// NOTE: candidate for @digigold/core — mirrors MainServer's expected auth request/response
// shapes; move it there once packages/libs/core is built and importable.

export type RequestOtpPayload = {
  mobileNumber: string;
};

export type RequestOtpResult = {
  success: boolean;
  message: string;
  is_registered: boolean;
  dev_otp?: string;
};

export type VerifyOtpPayload = {
  mobileNumber: string;
  otp: string;
};

export type VerifyOtpResult = {
  success: boolean;
  message: string;
  is_registered: boolean;
  access_token?: string;
  refresh_token?: string;
  registration_token?: string;
};

export type CompleteProfilePayload = {
  registrationToken: string;
  fullName: string;
  emailId?: string;
};
