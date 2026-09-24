package workers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/monitoring"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type EventConsumer struct {
	Redis               *redis_client.RedisClientStruct
	EventRepo           *repository.EventRepository
	TenantRepo          *repository.TenantRepository
	ConfigRepo          *repository.TenantConfigRepository
	HedgingRepo         *repository.HedgingRepository
	DefaultTenantConfig *models.TenantInternalConfig
	DefaultTenant       *models.Tenant
}

// StartEventConsumer should be called in a goroutine from your main.go
func StartEventConsumer(ctx context.Context) {
	consumer := &EventConsumer{
		Redis:       redis_client.InitRedisClient(),
		EventRepo:   repository.GetEventRepository(),
		TenantRepo:  repository.GetTenantRepository(),
		ConfigRepo:  repository.GetTenantConfigRepository(),
		HedgingRepo: repository.InitHedgingRepo(),
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
			go func(payload string) {
				evtCtx, cancel := context.WithTimeout(context.Background(), eventProcessTimeout)
				defer cancel()
				consumer.routeEvent(evtCtx, payload)
			}(msg.Payload)
		}
	}
}

// eventProcessTimeout bounds each event handler so a hung dependency cannot leak goroutines.
const eventProcessTimeout = 30 * time.Second

// routeEvent dispatches one event. Every event is claimed atomically in
// system_events first, so the API process, the worker process and cron
// republishes never handle the same event twice. An event that is not yet
// committed cannot be claimed; the outbox cron republishes it later.
func (c *EventConsumer) routeEvent(ctx context.Context, payloadStr string) {
	var baseEvent events.BaseEvent
	if err := json.Unmarshal([]byte(payloadStr), &baseEvent); err != nil {
		monitoring.Critical(ctx, monitoring.KindEventConsumer, fmt.Errorf("unreadable event: %w", err))
		return
	}

	// Trade events claim inside the same DB transaction as their side effects (exactly-once).
	if baseEvent.EventName == events.TradeEventGoldPurchase {
		if err := c.processTradeGoldPurchase(ctx, baseEvent); err != nil {
			log.Printf("ERROR: Processor failed for event %s (%s): %v\n", baseEvent.Id, baseEvent.EventName, err)
		}
		return
	}

	claimed, err := c.EventRepo.ClaimEvent(ctx, baseEvent.Id)
	if err != nil {
		log.Printf("ERROR: Failed to claim event %s: %v\n", baseEvent.Id, err)
		return
	}
	if !claimed {
		return // Already handled elsewhere, or its transaction has not committed yet.
	}

	var processErr error
	switch baseEvent.EventName {
	case events.OTPReqEvent: // Ensure events.OTPReqEvent strictly equals "OTPReqEvent"
		processErr = c.processWhatsAppOTP(ctx, baseEvent)
	default:
		// Audit-only events need no side effect; the claim marks them processed so
		// the outbox cron does not republish them forever.
		return
	}

	if processErr != nil {
		log.Printf("ERROR: Processor failed for event %s (%s): %v\n", baseEvent.Id, baseEvent.EventName, processErr)
		// Return the event to the outbox so the cron job retries it.
		if err := c.EventRepo.ReleaseEvent(context.Background(), baseEvent.Id); err != nil {
			monitoring.Critical(ctx, monitoring.KindEventConsumer, fmt.Errorf("event %s not released for retry: %w", baseEvent.Id, err))
		}
		return
	}
	log.Printf("✅ Successfully processed event: %s\n", baseEvent.EventName)
}
