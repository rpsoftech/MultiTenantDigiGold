// Purchases above this need verified KYC on every tenant. MainServer enforces the same
// figure (kycRequiredAboveINR in customer_trade_controller.go); this copy only drives UI.
export const KYC_REQUIRED_ABOVE_INR = 50_000;
