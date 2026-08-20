package workers

import (
	"context"
	"log"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
)

// StartOutboxRecoveryCron initializes the safety net worker that runs every 5 minutes.
func StartOutboxRecoveryCron(ctx context.Context) {
	eventRepo := repository.GetEventRepository()

	// Start the ticker for the 5-minute interval
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	log.Println("🛡️  Safety Net Cron Job started: Sweeping outbox every 5 minutes...")

	// We run an initial sweep immediately on boot.
	// This ensures any events that failed while the server was offline for deployment
	// are instantly recovered without waiting for the first 5-minute tick.
	go runOutboxSweep(ctx, eventRepo)

	// The Infinite Cron Loop
	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Safety Net Cron Job shutting down gracefully...")
			return
		case <-ticker.C:
			go runOutboxSweep(ctx, eventRepo)
		}
	}
}

func runOutboxSweep(ctx context.Context, repo *repository.EventRepository) {
	// 1. Strict Timeout for the Database Query
	// If the database is locked, we want this specific sweep to fail quickly
	// rather than hanging the entire cron routine indefinitely.
	queryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// 2. Fetch up to 100 unprocessed events older than 1 minute.
	// (The 1-minute buffer in your SQL query ensures we don't accidentally sweep
	// events that were just created and are currently processing normally).
	unprocessedEvents, err := repo.FetchUnprocessedEvents(queryCtx)
	if err != nil {
		log.Printf("⚠️ CRON ERROR: Failed to sweep system_events: %v\n", err)
		return
	}

	if len(unprocessedEvents) == 0 {
		return // System is perfectly healthy, nothing dropped.
	}

	log.Printf("🔄 CRON RECOVERY: Found %d dropped/failed events. Republishing to Redis...\n", len(unprocessedEvents))

	// 3. Republish each event to Redis Pub/Sub
	for _, event := range unprocessedEvents {
		// We spin off a goroutine for each publish to prevent a single slow Redis
		// connection from delaying the rest of the recovery batch.
		go func(evt *events.BaseEvent) {
			// Fire and forget with a fresh 5-second timeout
			bgCtx, cancelPub := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelPub()

			// Notice we simply call PublishEvent. We do NOT re-insert into PostgreSQL.
			if pubErr := repo.Redis.PublishEvent(bgCtx, evt); pubErr != nil {
				log.Printf("CRITICAL: Cron failed to republish event %s: %v\n", evt.Id, pubErr)
			} else {
				log.Printf("✅ Cron successfully recovered and republished event %s (%s)\n", evt.Id, evt.EventName)
			}
		}(event)
	}
}
