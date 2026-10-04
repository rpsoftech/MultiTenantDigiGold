package events

type AdminLoggedInEvent struct {
	BaseEvent
	Role string `json:"role"`
	IP   string `json:"ip"`
}

// AdminLoggedInPayload is what the event store records for a login. It must not be the
// event itself: the event embeds BaseEvent, whose Payload would then point back at the
// event, and json.Marshal fails on the cycle — which failed every admin TOTP login.
type AdminLoggedInPayload struct {
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
			Payload:                AdminLoggedInPayload{Role: role, IP: ip},
		},
		Role: role,
		IP:   ip,
	}
	event.CreateBaseEvent()
	return event
}
