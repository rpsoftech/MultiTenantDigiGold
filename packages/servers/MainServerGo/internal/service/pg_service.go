package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"github.com/razorpay/razorpay-go"
	"github.com/razorpay/razorpay-go/utils"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
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

// CreateOrder generates a Razorpay order and stores the trade intent in Redis.
func (s *PaymentGatewayService) CreateOrder(ctx context.Context, req interfaces.TradeExecutionRequest, tenantConfig *models.PaymentConfigJSON) (string, error) {
	if tenantConfig.KeyID == "" || tenantConfig.KeySecret == "" {
		return "", fmt.Errorf("tenant payment gateway is not configured properly")
	}

	client := razorpay.NewClient(tenantConfig.KeyID, tenantConfig.KeySecret)

	// Razorpay accepts amount in paise (INR * 100)
	amountPaise := toPaise(req.TotalAmountINR)
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
			"action":    req.Action,
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

	// Store intent in Redis for 15 minutes
	intentKey := fmt.Sprintf("digiGold:trade_intent:%s", orderID)
	reqBytes, _ := json.Marshal(req)
	if err := s.Redis.Client.Set(ctx, intentKey, reqBytes, 15*time.Minute).Err(); err != nil {
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

func toPaise(inr float64) int64 {
	return int64(math.Round(inr * 100))
}

// ProcessPaymentSuccess reads intent from Redis, checks that the captured payment
// matches it, executes the trade, and cleans up.
func (s *PaymentGatewayService) ProcessPaymentSuccess(ctx context.Context, tenantID int64, orderID, paymentID string, paidPaise int64) error {
	lockKey := fmt.Sprintf("digiGold:lock:payment:%s", paymentID)
	acquired, err := s.Redis.Client.SetNX(ctx, lockKey, "locked", 24*time.Hour).Result()
	if err != nil || !acquired {
		return fmt.Errorf("payment %s already processed or locked", paymentID)
	}

	intentKey := fmt.Sprintf("digiGold:trade_intent:%s", orderID)

	reqStr, err := s.Redis.Client.Get(ctx, intentKey).Result()
	if err != nil {
		s.Redis.Client.Del(ctx, lockKey) // Unlock if intent not found
		return fmt.Errorf("trade intent not found or expired for order %s: %w", orderID, err)
	}

	var req interfaces.TradeExecutionRequest
	if err := json.Unmarshal([]byte(reqStr), &req); err != nil {
		s.Redis.Client.Del(ctx, lockKey)
		return fmt.Errorf("failed to parse trade intent: %w", err)
	}

	// The intent must belong to the tenant whose secret signed the webhook, and
	// the captured amount must equal the amount the order was created for.
	if req.TenantID != tenantID {
		s.Redis.Client.Del(ctx, lockKey)
		return fmt.Errorf("trade intent tenant mismatch for order %s", orderID)
	}
	if paidPaise != toPaise(req.TotalAmountINR) {
		s.Redis.Client.Del(ctx, lockKey)
		return fmt.Errorf("paid amount %d paise does not match intent for order %s", paidPaise, orderID)
	}

	// Update ReferenceID to the actual payment ID
	req.ReferenceID = paymentID
	req.PaymentMode = "ONLINE_PG"

	// Execute Trade
	log.Printf("[PGService] Processing success for Order %s -> Payment %s", orderID, paymentID)
	_, err = s.TradeService.ExecuteTrade(ctx, req, "WEBHOOK", "SYSTEM")
	if err != nil {
		// Keep the intent and release the lock so a Razorpay retry can re-run the
		// trade. The trade runs in one DB transaction, so a failed run left no state.
		s.Redis.Client.Del(ctx, lockKey)
		return fmt.Errorf("trade execution failed: %w", err)
	}

	// Cleanup intent
	s.Redis.Client.Del(ctx, intentKey)
	return nil
}
