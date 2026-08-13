package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	workers "github.com/rpsoftech/DigiGold/MainServerGo/internal/worker"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

func main() {
	env.LoadEnv(env.ENV_FILE_NAME)
	log.Println("🚀 Booting Digi Gold Background Worker Microservice...")

	// 1. Create a cancellable context listening for OS termination signals (Docker Stop, Ctrl+C)
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// 2. Pre-flight Checks: Ping infrastructure before starting the consumer
	// Even though our repositories lazy-load, we want the container to crash
	// immediately on boot if the DB is down, rather than failing on the first event.
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

	// 3. Start the Central Event Consumer
	// Because StartEventConsumer contains an infinite for-loop, we run it in a Goroutine
	go workers.StartEventConsumer(ctx)

	// 4. Block the main thread until the OS termination signal is received
	<-ctx.Done()
	log.Println("🛑 Termination signal received. Initiating graceful shutdown...")

	// 5. The Graceful Buffer
	// Give active workers a brief 2-second window to finish their current WhatsApp API calls
	// and save their Outbox status to PostgreSQL before the OS completely kills the process.
	time.Sleep(2 * time.Second)
	log.Println("✅ Worker Microservice shut down safely.")
}
