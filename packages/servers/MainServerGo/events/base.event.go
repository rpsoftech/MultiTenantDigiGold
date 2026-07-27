package events

import (
	"encoding/json"
	"fmt"
	utility_functions "packages/servers/MainServerGo/utility/functions"
	"time"
)

type BaseEventInterface interface {
	GetPayloadString() string
	GetEventName() string
}

type BaseEvent struct {
	ObjId     string `bson:"_id" json:"_id"`
	Id        string `bson:"id" json:"id"`
	KeyId     string `bson:"key" json:"key"`
	EventName string `bson:"eventName" json:"eventName"`
	// IsProcessed bool        `bson:"isProcessed" json:"isProcessed"`
	ParentNames []string    `bson:"parentNames" json:"parentNames"`
	Payload     interface{} `bson:"payload" json:"payload"`
	AdminId     string      `bson:"adminId,omitempty" json:"adminId,omitempty"`
	OccurredAt  time.Time   `bson:"occurredAt" json:"occurredAt"`
	DataString  string      `bson:"-" json:"-"`
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
	return fmt.Sprintf("event/%s/%s", base.EventName, base.Id)
}
