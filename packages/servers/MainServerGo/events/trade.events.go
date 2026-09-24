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

const TradeEventPaymentRefunded = "TRADE_PAYMENT_REFUNDED"

// PaymentRefund is the payload of a TRADE_PAYMENT_REFUNDED audit event.
type PaymentRefund struct {
	OrderID     string `json:"order_id"`
	PaymentID   string `json:"payment_id"`
	RefundID    string `json:"refund_id"`
	AmountPaise int64  `json:"amount_paise"`
	Reason      string `json:"reason"`
}

// GeneratePaymentRefundedEvent records a captured payment that was refunded
// because no gold could be credited for it.
func GeneratePaymentRefundedEvent(tenantId string, refund *PaymentRefund) *TradeEvent {
	event := &TradeEvent{
		BaseEvent: BaseEvent{
			TenantId:               tenantId,
			EventName:              TradeEventPaymentRefunded,
			Payload:                refund,
			IpAddressAOccurredFrom: "WEBHOOK",
			AdminId:                "SYSTEM",
		},
	}
	event.CreateBaseEvent()
	return event
}

const TradeEventRedemptionCollected = "TRADE_REDEMPTION_COLLECTED"

// GenerateRedemptionCollectedEvent records that staff handed physical gold to a customer.
func GenerateRedemptionCollectedEvent(tenantId string, adminId string, ipAddress string, redemption *models.RedemptionRequest) *TradeEvent {
	event := &TradeEvent{
		BaseEvent: BaseEvent{
			TenantId:               tenantId,
			EventName:              TradeEventRedemptionCollected,
			Payload:                redemption,
			IpAddressAOccurredFrom: ipAddress,
			AdminId:                adminId,
		},
	}
	event.CreateBaseEvent()
	return event
}
