package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"sync"
	"time"

	"github.com/razorpay/razorpay-go"
	"github.com/razorpay/razorpay-go/utils"
	"github.com/redis/go-redis/v9"
	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/monitoring"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

var (
	pgServiceInstance *PaymentGatewayService
	pgServiceOnce     sync.Once
)

type PaymentGatewayService struct {
	Redis        *redis_client.RedisClientStruct
	TradeService *TradeService
}

func InitPaymentGatewayService() *PaymentGatewayService {
	pgServiceOnce.Do(func() {
		pgServiceInstance = &PaymentGatewayService{
			Redis:        redis_client.InitRedisClient(),
			TradeService: InitTradeService(),
		}
	})
	return pgServiceInstance
}

const (
	// intentTTL keeps an order's intent long enough to settle or refund a late
	// capture. The price itself is valid only until the quote expires.
	intentTTL = 7 * 24 * time.Hour

	// orderSource tags orders created by this service, so the webhook never
	// refunds a payment for an order that some other system created.
	orderSource = "digigold"
)

// tradeIntent is what CreateOrder stores and the webhook executes.
type tradeIntent struct {
	Request interfaces.TradeExecutionRequest `json:"request"`
	Quote   TradeQuote                       `json:"quote"`
}

// refundReason explains why a captured payment was refunded instead of settled.
type refundReason string

// CreateOrder generates a Razorpay order for a priced buy and stores the trade
// intent, including the locked quote, in Redis.
func (s *PaymentGatewayService) CreateOrder(ctx context.Context, req interfaces.TradeExecutionRequest, quote *TradeQuote, tenantConfig *models.PaymentConfigJSON) (string, error) {
	if tenantConfig.KeyID == "" || tenantConfig.KeySecret == "" {
		return "", fmt.Errorf("tenant payment gateway is not configured properly")
	}

	client := newRazorpayClient(tenantConfig)

	// Razorpay accepts amount in paise (INR * 100)
	amountPaise := toPaise(quote.TotalAmountINR)
	if amountPaise <= 0 {
		return "", interfaces.ErrInvalidTradePayload
	}

	data := map[string]interface{}{
		"amount":   amountPaise,
		"currency": "INR",
		"receipt":  "rcpt_" + fmt.Sprint(time.Now().Unix()),
		"notes": map[string]interface{}{
			"tenant_id": fmt.Sprint(req.TenantID),
			"user_id":   fmt.Sprint(req.UserID),
			"action":    "BUY",
			"source":    orderSource,
		},
	}

	body, err := client.Order.Create(data, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create razorpay order: %w", err)
	}

	orderID, ok := body["id"].(string)
	if !ok {
		return "", fmt.Errorf("invalid order response from razorpay")
	}

	intentKey := fmt.Sprintf("digiGold:trade_intent:%s", orderID)
	intentBytes, _ := json.Marshal(tradeIntent{Request: req, Quote: *quote})
	if err := s.Redis.Client.Set(ctx, intentKey, intentBytes, intentTTL).Err(); err != nil {
		return "", fmt.Errorf("failed to save trade intent to redis: %w", err)
	}

	log.Printf("[PGService] Created Order %s for Tenant %d", orderID, req.TenantID)
	return orderID, nil
}

// VerifyWebhookSignature validates the Razorpay webhook payload
func (s *PaymentGatewayService) VerifyWebhookSignature(webhookBody, signature, secret string) error {
	isValid := utils.VerifyWebhookSignature(webhookBody, signature, secret)
	if !isValid {
		return fmt.Errorf("invalid razorpay webhook signature")
	}
	return nil
}

// newRazorpayClient returns a Razorpay client for the tenant's keys.
// RAZORPAY_BASE_URL overrides the API host; only the integration tests set it,
// to point at a fake Razorpay server.
func newRazorpayClient(cfg *models.PaymentConfigJSON) *razorpay.Client {
	client := razorpay.NewClient(cfg.KeyID, cfg.KeySecret)
	if baseURL := os.Getenv("RAZORPAY_BASE_URL"); baseURL != "" {
		client.Request.BaseURL = baseURL
	}
	return client
}

func toPaise(inr float64) int64 {
	return int64(math.Round(inr * 100))
}

// CapturedPayment is a verified payment.captured webhook.
type CapturedPayment struct {
	TenantID  int64
	OrderID   string
	PaymentID string
	PaidPaise int64
	Source    string // notes.source of the order
}

// ProcessPaymentSuccess settles a captured payment. It credits gold at the
// quote locked when the order was created. If the payment can never be settled
// (quote expired, amount mismatch, store out of credit...), it refunds the
// payment instead. It returns an error only for failures worth a webhook retry.
func (s *PaymentGatewayService) ProcessPaymentSuccess(ctx context.Context, p CapturedPayment, tenantConfig *models.PaymentConfigJSON) error {
	lockKey := fmt.Sprintf("digiGold:lock:payment:%s", p.PaymentID)
	acquired, err := s.Redis.Client.SetNX(ctx, lockKey, "locked", 24*time.Hour).Result()
	if err != nil {
		return fmt.Errorf("failed to lock payment %s: %w", p.PaymentID, err)
	}
	if !acquired {
		// Already settled or refunded, or another delivery is working on it.
		log.Printf("[PGService] Payment %s already processed or locked", p.PaymentID)
		return nil
	}

	// settled is set once the payment reached a final state (credited or refunded);
	// otherwise the lock is released so a Razorpay retry can run again.
	settled := false
	defer func() {
		if !settled {
			s.Redis.Client.Del(context.Background(), lockKey)
		}
	}()

	intentKey := fmt.Sprintf("digiGold:trade_intent:%s", p.OrderID)
	intentStr, err := s.Redis.Client.Get(ctx, intentKey).Result()
	if errors.Is(err, redis.Nil) {
		if p.Source != orderSource {
			// Not an order this service created: leave the money alone.
			log.Printf("[PGService] Ignoring payment %s for unknown order %s", p.PaymentID, p.OrderID)
			settled = true
			return nil
		}
		return s.refund(ctx, p, tenantConfig, "trade intent expired or missing", &settled)
	}
	if err != nil {
		return fmt.Errorf("failed to read trade intent for order %s: %w", p.OrderID, err)
	}

	var intent tradeIntent
	if err := json.Unmarshal([]byte(intentStr), &intent); err != nil {
		return s.refund(ctx, p, tenantConfig, "trade intent unreadable", &settled)
	}
	req := intent.Request

	// The intent must belong to the tenant whose secret signed the webhook, and
	// the captured amount must equal the amount the order was created for.
	if req.TenantID != p.TenantID {
		return s.refund(ctx, p, tenantConfig, "trade intent tenant mismatch", &settled)
	}
	if p.PaidPaise != toPaise(intent.Quote.TotalAmountINR) {
		return s.refund(ctx, p, tenantConfig, "paid amount does not match order", &settled)
	}
	if intent.Quote.Expired(time.Now()) {
		return s.refund(ctx, p, tenantConfig, "price quote expired before payment", &settled)
	}

	req.ReferenceID = p.PaymentID
	req.PaymentMode = "ONLINE_PG"

	log.Printf("[PGService] Processing success for Order %s -> Payment %s", p.OrderID, p.PaymentID)
	_, err = s.TradeService.ExecuteQuotedTrade(ctx, req, &intent.Quote, "WEBHOOK", "SYSTEM")
	if err != nil {
		if isPermanentTradeError(err) {
			return s.refund(ctx, p, tenantConfig, refundReason("trade rejected: "+err.Error()), &settled)
		}
		// Transient failure: the trade ran in one DB transaction and left no state,
		// so keep the intent and let Razorpay retry.
		return fmt.Errorf("trade execution failed: %w", err)
	}

	settled = true
	s.Redis.Client.Del(ctx, intentKey)
	return nil
}

// isPermanentTradeError reports whether a retry of the same trade can never succeed.
func isPermanentTradeError(err error) bool {
	return errors.Is(err, interfaces.ErrCreditLimitExceeded) ||
		errors.Is(err, interfaces.ErrUserNotFound) ||
		errors.Is(err, interfaces.ErrInvalidTradePayload)
}

// refund returns the full captured amount to the customer and records it in the
// event log. On success it marks the payment settled and deletes the intent.
func (s *PaymentGatewayService) refund(ctx context.Context, p CapturedPayment, tenantConfig *models.PaymentConfigJSON, reason refundReason, settled *bool) error {
	log.Printf("[PGService] Refunding payment %s (order %s): %s", p.PaymentID, p.OrderID, reason)

	client := newRazorpayClient(tenantConfig)
	body, err := client.Payment.Refund(p.PaymentID, int(p.PaidPaise), map[string]interface{}{
		"notes": map[string]interface{}{"reason": string(reason)},
	}, nil)
	if err != nil {
		// The customer has paid and holds no gold until a retry succeeds.
		err = fmt.Errorf("failed to refund payment %s (%s): %w", p.PaymentID, reason, err)
		monitoring.Critical(ctx, monitoring.KindRefundFailed, err)
		return err
	}
	*settled = true
	monitoring.PaymentRefunded(ctx, string(reason))
	s.Redis.Client.Del(ctx, fmt.Sprintf("digiGold:trade_intent:%s", p.OrderID))

	refundID, _ := body["id"].(string)
	refundEvent := events.GeneratePaymentRefundedEvent(fmt.Sprint(p.TenantID), &events.PaymentRefund{
		OrderID:     p.OrderID,
		PaymentID:   p.PaymentID,
		RefundID:    refundID,
		AmountPaise: p.PaidPaise,
		Reason:      string(reason),
	})
	if err := s.TradeService.EventRepo.SaveEventWithContext(ctx, &refundEvent.BaseEvent); err != nil {
		// The money is already back with the customer; a missing audit row must not trigger a retry.
		monitoring.Critical(ctx, monitoring.KindRefundNotLogged,
			fmt.Errorf("refund %s for payment %s not recorded in event log: %w", refundID, p.PaymentID, err))
	}
	return nil
}
