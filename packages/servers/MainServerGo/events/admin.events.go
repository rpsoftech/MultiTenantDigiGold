package events

type AdminLoggedInEvent struct {
	BaseEvent
	Role string `json:"role"`
	IP   string `json:"ip"`
}

type adminLoggedInPayload struct {
	Role string `json:"role"`
	IP   string `json:"ip"`
}

func GenerateAdminLoggedInEvent(tenantID, adminUUID, role, ip string) *AdminLoggedInEvent {
	event := &AdminLoggedInEvent{
		BaseEvent: BaseEvent{
			EventName:              "ADMIN_LOGGED_IN",
			TenantId:               tenantID,
			AdminId:                adminUUID,
			IpAddressAOccurredFrom: ip,
			Payload:                adminLoggedInPayload{Role: role, IP: ip},
		},
		Role: role,
		IP:   ip,
	}
	event.CreateBaseEvent()
	return event
}
