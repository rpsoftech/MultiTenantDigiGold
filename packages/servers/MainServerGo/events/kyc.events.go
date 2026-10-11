package events

// KYCDecidedEvent records an admin approving or rejecting a customer's KYC submission.
const KYCDecidedEvent = "KYC_DECIDED"

// KYCDecision is the KYC_DECIDED payload. The documents themselves are not copied in.
type KYCDecision struct {
	UserUUID string `json:"user_uuid"`
	// "verified" or "rejected".
	Status string `json:"status"`
}

func GenerateKYCDecidedEvent(tenantUUID, adminUUID, ipAddress string, decision KYCDecision) *BaseEvent {
	event := &BaseEvent{
		EventName:              KYCDecidedEvent,
		TenantId:               tenantUUID,
		KeyId:                  decision.UserUUID,
		AdminId:                adminUUID,
		IpAddressAOccurredFrom: ipAddress,
		Payload:                decision,
	}
	event.CreateBaseEvent()
	return event
}
