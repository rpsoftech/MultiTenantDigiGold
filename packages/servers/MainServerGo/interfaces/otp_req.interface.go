package interfaces

type (
	OTPRequest struct {
		OtpCode  string `json:"otpCode"`
		TenantId string `json:"tenantId"`
		Phone    string `json:"phone"`
		Name     string `json:"name"`
		ReqId    string `json:"reqId"`
	}
)
