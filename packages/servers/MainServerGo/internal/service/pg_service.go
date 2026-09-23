package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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
	amountPaise := int(req.TotalAmountINR * 100)

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

// ProcessPaymentSuccess reads intent from Redis, executes trade, and cleans up.
func (s *PaymentGatewayService) ProcessPaymentSuccess(ctx context.Context, orderID, paymentID string) error {
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

	// Update ReferenceID to the actual payment ID
	req.ReferenceID = paymentID
	req.PaymentMode = "ONLINE_PG"

	// Execute Trade
	log.Printf("[PGService] Processing success for Order %s -> Payment %s", orderID, paymentID)
	_, err = s.TradeService.ExecuteTrade(ctx, req, "WEBHOOK", "SYSTEM")
	if err != nil {
		// Do not delete intent if execution fails, might need manual resolution or retry
		return fmt.Errorf("trade execution failed: %w", err)
	}

	// Cleanup intent
	s.Redis.Client.Del(ctx, intentKey)
	return nil
}
