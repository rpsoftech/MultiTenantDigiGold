package workers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type EventConsumer struct {
	Redis               *redis_client.RedisClientStruct
	EventRepo           *repository.EventRepository
	TenantRepo          *repository.TenantRepository
	ConfigRepo          *repository.TenantConfigRepository
	DefaultTenantConfig *models.TenantInternalConfig
	DefaultTenant       *models.Tenant
}

// StartEventConsumer should be called in a goroutine from your main.go
func StartEventConsumer(ctx context.Context) {
	consumer := &EventConsumer{
		Redis:      redis_client.InitRedisClient(),
		EventRepo:  repository.GetEventRepository(),
		TenantRepo: repository.GetTenantRepository(),
		ConfigRepo: repository.GetTenantConfigRepository(),
	}
	defaultTenant, err := consumer.TenantRepo.GetFullTenantByShortName(ctx, "default")
	if err != nil {
		log.Printf("CRITICAL: Failed to fetch default tenant: %v\n", err)
		consumer.handleCriticalError("default", "Initial Config", fmt.Errorf("Default Tenant Not Found"))
	}
	consumer.DefaultTenant = defaultTenant

	defaultTenantConfig, err := consumer.ConfigRepo.GetConfigByTenantUUID(ctx, defaultTenant.UUID)
	if err != nil {
		log.Printf("CRITICAL: Failed to fetch default tenant config: %v\n", err)
		consumer.handleCriticalError("default", "Initial Config", fmt.Errorf("Default Tenant Config Not Found"))
	}
	consumer.DefaultTenantConfig = defaultTenantConfig

	// 1. PSubscribe catches ALL events matching the pattern
	pubsub := consumer.Redis.Client.PSubscribe(ctx, "event/*")
	defer pubsub.Close()

	log.Println("🚀 Central Event Consumer actively listening to Redis stream...")
	ch := pubsub.Channel()

	// 2. The Infinite Listening Loop with Graceful Shutdown
	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Shutting down Event Consumer gracefully...")
			return
		case msg := <-ch:
			// 3. Spin off a new goroutine for every single event.
			// This ensures one slow API call doesn't block the rest of the queue.
			go consumer.routeEvent(context.Background(), msg.Payload)
		}
	}
}

func (c *EventConsumer) routeEvent(ctx context.Context, payloadStr string) {
	// A. Unmarshal the outer BaseEvent wrapper
	var baseEvent events.BaseEvent
	if err := json.Unmarshal([]byte(payloadStr), &baseEvent); err != nil {
		log.Printf("CRITICAL: Failed to unmarshal BaseEvent: %v\n", err)
		return
	}

	// B. Route based on the EventName string
	var processErr error
	switch baseEvent.EventName {
	case events.OTPReqEvent:
		processErr = c.processWhatsAppOTP(ctx, baseEvent)
	case events.TenantCreatedEvent:
		// processErr = c.processTenantCreated(ctx, baseEvent)
	// Add future events here (e.g., SIPMandateFailed, PaymentReceived)
	default:
		log.Printf("⚠️ Unhandled event type dropped: %s\n", baseEvent.EventName)
		return
	}

	// C. Error Handling (The Safety Net)
	if processErr != nil {
		// We DO NOT mark it as processed. The PostgreSQL Cron job will pick this up later and retry.
		log.Printf("ERROR: Processor failed for event %s (%s): %v\n", baseEvent.Id, baseEvent.EventName, processErr)
		return
	}

	// D. The Fast Path: Mark as Processed in PostgreSQL
	// This closes the Transactional Outbox loop, proving the task was 100% completed.
	if err := c.EventRepo.MarkEventAsProcessed(ctx, baseEvent.Id); err != nil {
		log.Printf("CRITICAL: Failed to mark event %s as processed in DB: %v\n", baseEvent.Id, err)
	} else {
		log.Printf("✅ Successfully processed event: %s\n", baseEvent.EventName)
	}
}
