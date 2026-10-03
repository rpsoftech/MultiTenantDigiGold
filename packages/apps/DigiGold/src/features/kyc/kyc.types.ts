// NOTE: candidate for @digigold/core, mirrors the body MainServer stores in
// users.user_document_json via POST /user/kyc.
export type SubmitKycPayload = {
  pan_number: string;
  aadhaar_last4: string;
  // Optional until MainServer exposes a document upload endpoint, omitted when blank.
  document_url?: string;
};

export type SubmitKycResult = {
  success: boolean;
  message: string;
};
