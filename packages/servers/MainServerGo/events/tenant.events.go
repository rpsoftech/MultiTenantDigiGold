package events

import "github.com/rpsoftech/DigiGold/MainServerGo/internal/models"

type tenantEvent struct {
	*BaseEvent `bson:"inline"`
}

const (
	TenantCreatedEvent = "TenantCreated"
	TenantUpdatedEvent = "TenantUpdated"
	TenantDeletedEvent = "TenantDeleted"
)

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
