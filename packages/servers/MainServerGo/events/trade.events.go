package events

import (
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
)

const (
	TradeEventGoldPurchase = "TRADE_GOLD_PURCHASE"
)

type TradeEvent struct {
	BaseEvent
}

func GenerateGoldPurchaseEvent(tenantId string, adminId string, ipAddress string, ledger *models.GoldTransactionLedger) *TradeEvent {
	event := &TradeEvent{
		BaseEvent: BaseEvent{
			TenantId:               tenantId,
			EventName:              TradeEventGoldPurchase,
			Payload:                ledger,
			IpAddressAOccurredFrom: ipAddress,
			AdminId:                adminId,
		},
	}
	event.CreateBaseEvent()
	return event
}
