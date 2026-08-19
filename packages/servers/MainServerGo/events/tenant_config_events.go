package events

import (
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
)

// 1. The Internal Event Wrapper (Unexported to enforce structural integrity)
type tenantConfigEvent struct {
	*BaseEvent `bson:"inline"`
}

// Add sets up the heritage and triggers the CRITICAL base UUID/Timestamp generation
func (base *tenantConfigEvent) Add() *tenantConfigEvent {
	base.ParentNames = []string{base.EventName, "TenantConfigEvent"}
	base.CreateBaseEvent() // Generates the UUID and OccurredAt timestamp
	return base
}

// ==========================================
// EVENT CONSTRUCTORS
// ==========================================

// CreateNewTenantConfigUpdated logs when a Retail Admin or Super Admin updates API keys or Webhooks
func CreateNewTenantConfigUpdated(entity *models.TenantInternalConfig, adminId string, tenantUUID string) *BaseEvent {
	event := &tenantConfigEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID, // The UUID of the Config row itself
			TenantId:  tenantUUID,  // Strict Tenant Isolation mapping
			AdminId:   adminId,     // The ID of the manager who made the change
			Payload:   entity,      // The JSONB payload containing the new settings
			EventName: "TenantConfigUpdated",
		},
	}

	event.Add()
	return event.BaseEvent
}
