package events

type AdminLoggedInEvent struct {
	BaseEvent
	Role string `json:"role"`
	IP   string `json:"ip"`
}

func GenerateAdminLoggedInEvent(tenantID, adminUUID, role, ip string) *AdminLoggedInEvent {
	event := &AdminLoggedInEvent{
		BaseEvent: BaseEvent{
			EventName: "ADMIN_LOGGED_IN",
			TenantId:  tenantID,
			AdminId:   adminUUID,
		},
		Role: role,
	}
	event.CreateBaseEvent()
	event.Payload = event
	return event
}
