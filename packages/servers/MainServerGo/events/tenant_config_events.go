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

// CreateNewTenantConfigUpdated logs when a Retail Admin or Super Admin updates API keys or Webhooks.
// The stored payload has the gateway and WhatsApp secrets redacted: nothing reads them back
// from the event log, and system_events must not become a second copy of the credentials.
func CreateNewTenantConfigUpdated(entity *models.TenantInternalConfig, adminId string, tenantUUID string) *BaseEvent {
	event := &tenantConfigEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID, // The UUID of the Config row itself
			TenantId:  tenantUUID,  // Strict Tenant Isolation mapping
			AdminId:   adminId,     // The ID of the manager who made the change
			Payload:   RedactedForStorage(entity),
			EventName: "TenantConfigUpdated",
		},
	}

	event.Add()
	return event.BaseEvent
}

func CreateNewMarginUpdated(entity *models.MarginConfig, adminId string, tenantUUID string) *BaseEvent {
	event := &tenantConfigEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID,
			TenantId:  tenantUUID,
			AdminId:   adminId,
			Payload:   entity,
			EventName: "MARGIN_UPDATED",
		},
	}
	event.Add()
	return event.BaseEvent
}

// CreateNewTenantUILayoutUpdated logs a new storefront layout for the tenant.
func CreateNewTenantUILayoutUpdated(uiConfig any, adminId string, tenantUUID string) *BaseEvent {
	event := &tenantConfigEvent{
		BaseEvent: &BaseEvent{
			KeyId:     tenantUUID,
			TenantId:  tenantUUID,
			AdminId:   adminId,
			Payload:   map[string]any{"updated_by": adminId, "ui_config": uiConfig},
			EventName: "TENANT_UI_LAYOUT_UPDATED",
		},
	}
	event.Add()
	return event.BaseEvent
}

func CreateNewKYCDocUploaded(entity *models.TenantKYCDocument, adminId string, tenantUUID string) *BaseEvent {
	event := &tenantConfigEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID,
			TenantId:  tenantUUID,
			AdminId:   adminId,
			Payload:   entity,
			EventName: "KYC_DOC_UPLOADED",
		},
	}
	event.Add()
	return event.BaseEvent
}

func CreateNewKYCDocVerified(entity *models.TenantKYCDocument, adminId string, tenantUUID string) *BaseEvent {
	event := &tenantConfigEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID,
			TenantId:  tenantUUID,
			AdminId:   adminId,
			Payload:   entity,
			EventName: "KYC_DOC_VERIFIED",
		},
	}
	event.Add()
	return event.BaseEvent
}
