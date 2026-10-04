package events

import (
	"encoding/json"
	"testing"
)

// EventRepository.SaveEventWithTx stores json.Marshal(event.Payload); a self-referencing
// payload made that fail and with it every admin login.
func TestAdminLoggedInEvent_PayloadMarshals(t *testing.T) {
	event := GenerateAdminLoggedInEvent("2", "admin-uuid", "MANAGER", "203.0.113.7")

	raw, err := json.Marshal(event.Payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	var payload AdminLoggedInPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if payload.Role != "MANAGER" || payload.IP != "203.0.113.7" {
		t.Fatalf("payload = %+v, want role MANAGER and the login IP", payload)
	}

	if event.IpAddressAOccurredFrom != "203.0.113.7" || event.IP != "203.0.113.7" {
		t.Fatalf("event IP not recorded: base=%q field=%q", event.IpAddressAOccurredFrom, event.IP)
	}
	if event.EventName != "ADMIN_LOGGED_IN" || event.Id == "" || event.OccurredAt.IsZero() {
		t.Fatalf("base event not initialised: %+v", event.BaseEvent)
	}
	if event.GetPayloadString() == "" {
		t.Fatal("GetPayloadString returned empty for a marshalable event")
	}
}
