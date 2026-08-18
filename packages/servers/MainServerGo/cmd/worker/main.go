package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	workers "github.com/rpsoftech/DigiGold/MainServerGo/internal/worker"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/updater"
)

var version string = "0" // Injected by deploy script

func main() {
	env.LoadEnv(env.ENV_FILE_NAME)
	log.Println("🚀 Booting Digi Gold Background Worker Microservice...")

	// 1. Create a cancellable context listening for OS termination signals (Docker Stop, Ctrl+C)
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// 2. The 5-Minute OTA Updater Daemon (Worker Target)
	if env.Env.APP_ENV == env.APP_ENV_PRODUCTION {
		// We pass the context to know when to stop ticking, and the cancel function to trigger a restart
		go func(versionStr string, workerCtx context.Context, triggerRestart context.CancelFunc) {
			currentVersion, _ := strconv.Atoi(versionStr)

			runCheck := func() {
				// Notice we target "worker" instead of "api"
				updated, err := updater.CheckAndUpdate("https://keyvalue.rpso.in/public/", "worker", currentVersion)
				if err != nil {
					log.Printf("⚠️ OTA Updater: %v\n", err)
					return
				}

				if updated {
					log.Println("🔄 OTA Update applied successfully! Triggering graceful restart...")
					// Instantly alerts <-ctx.Done() on the main thread
					triggerRestart()
				}
			}

			// Run immediately on boot
			runCheck()

			// Schedule to run exactly every 5 minutes
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()

			for {
				select {
				case <-workerCtx.Done(): // If the OS kills the app, stop checking for updates
					return
				case <-ticker.C:
					runCheck()
				}
			}
		}(version, ctx, cancel)
	}

	// 3. Pre-flight Checks: Ping infrastructure before starting the consumer
	db := postgres.GetPostgresDB()
	if err := db.Db.PingContext(ctx); err != nil {
		log.Fatalf("FATAL: PostgreSQL connection failed: %v", err)
	}
	log.Println("✅ PostgreSQL connected successfully.")

	rdb := redis_client.InitRedisClient()
	if err := rdb.Client.Ping(ctx).Err(); err != nil {
		log.Fatalf("FATAL: Redis connection failed: %v", err)
	}
	log.Println("✅ Redis connected successfully.")

	// 4. Start the Background Services
	// Starts the Redis listener to process events instantly
	go workers.StartEventConsumer(ctx)

	// Starts the safety net sweeper to catch dropped PostgreSQL outbox events
	go workers.StartOutboxRecoveryCron(ctx)

	// 5. Block the main thread until the OS termination signal (or OTA update) is received
	<-ctx.Done()
	log.Println("🛑 Termination signal received. Initiating graceful shutdown...")

	// 6. The Graceful Buffer
	// Give active workers a brief 2-second window to finish their current WhatsApp API calls
	// and save their Outbox status to PostgreSQL before the OS completely kills the process.
	time.Sleep(2 * time.Second)
	log.Println("✅ Worker Microservice shut down safely.")
}
