package events

import "github.com/rpsoftech/DigiGold/MainServerGo/internal/models"

type tenantEvent struct {
	*BaseEvent `bson:"inline"`
}

const (
	TenantCreatedEvent     = "TenantCreated"
	TenantUpdatedEvent     = "TenantUpdated"
	TenantDeletedEvent     = "TenantDeleted"
	TenantActivatedEvent   = "TENANT_ACTIVATED"
	TenantDeactivatedEvent = "TENANT_DEACTIVATED"
)

// CreateNewTenantStatusChanged logs a store being reactivated or suspended.
func CreateNewTenantStatusChanged(entity *models.Tenant, adminId string) *tenantEvent {
	name := TenantDeactivatedEvent
	if entity.IsActive {
		name = TenantActivatedEvent
	}
	event := &tenantEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID,
			TenantId:  entity.UUID,
			AdminId:   adminId,
			Payload:   map[string]any{"tenant_uuid": entity.UUID, "is_active": entity.IsActive},
			EventName: name,
		},
	}
	event.Add()
	return event
}

func (base *tenantEvent) Add() *tenantEvent {
	base.ParentNames = []string{base.EventName, "TenantEvent"}
	base.CreateBaseEvent()
	return base
}

func CreateNewTenantDeleted(entity *models.Tenant, adminId string) *tenantEvent {
	event := &tenantEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID,
			TenantId:  entity.UUID,
			AdminId:   adminId,
			Payload:   entity,
			EventName: TenantDeletedEvent,
		},
	}
	event.Add()
	return event
}
func CreateNewTenantUpdated(entity *models.Tenant, adminId string) *tenantEvent {
	event := &tenantEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID,
			TenantId:  entity.UUID,
			AdminId:   adminId,
			Payload:   entity,
			EventName: TenantUpdatedEvent,
		},
	}
	event.Add()
	return event
}
func CreateNewTenantCreated(entity *models.Tenant, adminId string) *tenantEvent {
	event := &tenantEvent{
		BaseEvent: &BaseEvent{
			KeyId:     entity.UUID,
			TenantId:  entity.UUID,
			AdminId:   adminId,
			Payload:   entity,
			EventName: TenantCreatedEvent,
		},
	}
	event.Add()
	return event
}
