package events

import (
	"encoding/json"
	"testing"
)

func TestGenerateAdminLoggedInEventSerializesWithoutCycle(t *testing.T) {
	event := GenerateAdminLoggedInEvent("tenant-id", "admin-id", "manager", "192.0.2.10")

	payloadJSON, err := json.Marshal(event.Payload)
	if err != nil {
		t.Fatalf("marshal login event payload: %v", err)
	}
	var payload map[string]string
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		t.Fatalf("decode login payload: %v", err)
	}
	if len(payload) != 2 || payload["role"] != "manager" || payload["ip"] != "192.0.2.10" {
		t.Fatalf("expected only role and ip in login payload, got %s", payloadJSON)
	}

	baseJSON, err := json.Marshal(&event.BaseEvent)
	if err != nil {
		t.Fatalf("marshal login base event: %v", err)
	}
	if serialized := event.GetPayloadString(); serialized != string(baseJSON) {
		t.Fatalf("GetPayloadString did not serialize the base event: %q", serialized)
	}
	if _, err := json.Marshal(event); err != nil {
		t.Fatalf("marshal complete login event: %v", err)
	}

	var restored BaseEvent
	if err := json.Unmarshal(baseJSON, &restored); err != nil {
		t.Fatalf("decode login base event: %v", err)
	}
	if restored.EventName != "ADMIN_LOGGED_IN" || restored.TenantId != "tenant-id" || restored.AdminId != "admin-id" {
		t.Fatalf("login event metadata was not preserved: %+v", restored)
	}
	if restored.IpAddressAOccurredFrom != "192.0.2.10" {
		t.Fatalf("login IP metadata was not preserved: %q", restored.IpAddressAOccurredFrom)
	}
	if restored.Id == "" || restored.ObjId != restored.Id || restored.OccurredAt.IsZero() {
		t.Fatalf("login event ID and occurrence time were not initialized: %+v", restored)
	}
	if event.Role != "manager" || event.IP != "192.0.2.10" {
		t.Fatalf("login event details were not preserved: role=%q ip=%q", event.Role, event.IP)
	}
}
