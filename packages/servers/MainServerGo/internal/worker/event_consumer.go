package workers

import (
	"context"
	"encoding/json"
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

	// 1. SAFE BOOTSTRAPPING: Prevent Nil Pointer Dereference
	defaultTenant, err := consumer.TenantRepo.GetFullTenantByShortName(ctx, "default")
	if err != nil {
		log.Printf("⚠️ WARNING: Failed to fetch default tenant on boot: %v\n", err)
		// We DO NOT panic or crash. We simply skip loading the default config.
		// Your whatsapp_processor is already designed to fallback safely if a config is missing!
	} else {
		consumer.DefaultTenant = defaultTenant
		defaultTenantConfig, err := consumer.ConfigRepo.GetConfigByTenantUUID(ctx, defaultTenant.UUID)
		if err != nil {
			log.Printf("⚠️ WARNING: Failed to fetch default tenant config: %v\n", err)
		} else {
			consumer.DefaultTenantConfig = defaultTenantConfig
		}
	}

	// 2. SUBSCRIBE TO THE PATTERN
	// The pattern 'digiGold:event*' flawlessly matches your string:
	// "digiGold:event:48a9a05a-c106-4d26-97f8-0619198cc98a:OTPReqEvent:f8a67abf..."
	pubsub := consumer.Redis.Client.PSubscribe(ctx, consumer.Redis.GetRedisEventKey("*"))
	defer pubsub.Close()

	log.Println("🚀 Central Event Consumer actively listening to Redis stream...")
	ch := pubsub.Channel()

	// 3. THE INFINITE LISTENING LOOP
	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Shutting down Event Consumer gracefully...")
			return
		case msg, ok := <-ch:
			// CRITICAL FIX: If Redis restarts/disconnects, the channel closes.
			// We must check 'ok' to prevent a nil pointer panic on msg.Payload.
			if !ok {
				log.Println("⚠️ Redis PubSub channel closed unexpectedly. Exiting consumer loop...")
				return
			}
			go consumer.routeEvent(context.Background(), msg.Payload)
		}
	}
}

func (c *EventConsumer) routeEvent(ctx context.Context, payloadStr string) {
	var baseEvent events.BaseEvent
	if err := json.Unmarshal([]byte(payloadStr), &baseEvent); err != nil {
		log.Printf("CRITICAL: Failed to unmarshal BaseEvent: %v\n", err)
		return
	}

	var processErr error
	switch baseEvent.EventName {
	case events.OTPReqEvent: // Ensure events.OTPReqEvent strictly equals "OTPReqEvent"
		processErr = c.processWhatsAppOTP(ctx, baseEvent)
	// case events.TenantCreatedEvent:
	// processErr = c.processTenantCreated(ctx, baseEvent)
	default:
		log.Printf("⚠️ Unhandled event type dropped: %s\n", baseEvent.EventName)
		return
	}

	if processErr != nil {
		log.Printf("ERROR: Processor failed for event %s (%s): %v\n", baseEvent.Id, baseEvent.EventName, processErr)
		return // Leave is_processed = false so the Cron Job picks it up
	}

	if err := c.EventRepo.MarkEventAsProcessed(ctx, baseEvent.Id); err != nil {
		log.Printf("CRITICAL: Failed to mark event %s as processed in DB: %v\n", baseEvent.Id, err)
	} else {
		log.Printf("✅ Successfully processed event: %s\n", baseEvent.EventName)
	}
}
