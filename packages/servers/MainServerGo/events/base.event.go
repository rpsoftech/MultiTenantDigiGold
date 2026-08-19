package events

import (
	"encoding/json"
	"fmt"
	"time"

	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
)

type BaseEventInterface interface {
	GetPayloadString() string
	GetEventName() string
}

type BaseEvent struct {
	ObjId                  string      `bson:"_id" json:"_id"`
	Id                     string      `bson:"id" json:"id"`
	KeyId                  string      `bson:"key" json:"key"`
	TenantId               string      `bson:"tenantId" json:"tenantId"`
	EventName              string      `bson:"eventName" json:"eventName"`
	IsProcessed            bool        `bson:"isProcessed" json:"isProcessed"`
	ParentNames            []string    `bson:"parentNames" json:"parentNames"`
	Payload                interface{} `bson:"payload" json:"payload"`
	IpAddressAOccurredFrom string      `bson:"ipAddressAOccurredFrom,omitempty" json:"ipAddressAOccurredFrom,omitempty"`
	AdminId                string      `bson:"adminId,omitempty" json:"adminId,omitempty"`
	OccurredAt             time.Time   `bson:"occurredAt" json:"occurredAt"`
	DataString             string      `bson:"-" json:"-"`
}

func (base *BaseEvent) CreateBaseEvent() *BaseEvent {
	base.Id = utility_functions.GenerateNewUUID()
	base.ObjId = base.Id
	base.OccurredAt = time.Now()
	// base.IsProcessed = false
	return base
}

func (base *BaseEvent) GetPayloadString() string {
	if base.DataString != "" {
		return base.DataString
	}
	payload, _ := json.Marshal(base)
	return string(payload)
}
func (base *BaseEvent) GetEventName() string {
	return fmt.Sprintf("event:%s:%s:%s", base.TenantId, base.EventName, base.Id)
}
