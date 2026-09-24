package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v3"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	rates_api "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/rates"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/server"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/worker"
	otel_setup "github.com/rpsoftech/DigiGold/MainServerGo/utility/otel"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/updater"
)

var version string = "0" // Injected by deploy script

func main() {
	log.SetOutput(os.Stdout)
	env.LoadEnv("digiGold.env")
	log.Println("🚀 Booting Digi Gold HTTP API Server (Fiber v3)...")

	// 1. Move the termination channel to the top so our background workers can trigger a restart
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	tp, err := otel_setup.InitTracer(ctx, "digigold-api")
	if err != nil {
		log.Printf("⚠️ OpenTelemetry failed to initialize: %v (Proceeding without tracing)\n", err)
	} else {
		defer func() {
			if err := tp.Shutdown(context.Background()); err != nil {
				log.Printf("Error shutting down tracer provider: %v", err)
			}
		}()
	}

	mp, err := otel_setup.InitMeter(ctx, "digigold-api")
	if err != nil {
		log.Printf("⚠️ OpenTelemetry metrics failed to initialize: %v (Proceeding without metrics)\n", err)
	} else {
		defer func() { _ = mp.Shutdown(context.Background()) }()
	}

	// 2. The 5-Minute OTA Updater Daemon
	// 2. The 5-Minute OTA Updater Daemon
	if env.Env.APP_ENV == env.APP_ENV_PRODUCTION || env.Env.APP_ENV == env.APP_ENV_STAGING {
		// Pass 'cancel' directly as triggerRestart
		go func(versionStr string, triggerRestart context.CancelFunc) {
			currentVersion, _ := strconv.Atoi(versionStr)

			runCheck := func() {
				updated, err := updater.CheckAndUpdate(string(env.Env.APP_ENV), "https://keyvalue.rpso.in/public/", "api", currentVersion)
				if err != nil {
					log.Printf("⚠️ OTA Updater: %v\n", err)
					return
				}

				if updated {
					log.Println("🔄 OTA Update applied successfully! Triggering graceful restart...")
					triggerRestart() // <--- Instantly fires ctx.Done() globally!
				}
			}

			runCheck()
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done(): // Stop ticking if the server is shutting down
					return
				case <-ticker.C:
					runCheck()
				}
			}
		}(version, cancel)
	}
	// 3. Pre-flight Infrastructure Checks
	db := postgres.GetPostgresDB()
	defer db.Db.Close()

	if err := db.Db.Ping(); err != nil {
		log.Fatalf("FATAL: PostgreSQL connection failed: %v", err)
	}
	// Apply pending schema migrations before any repository prepares its statements.
	if err := database.MigrateUp(db.Db); err != nil {
		log.Fatalf("FATAL: %v", err)
	}
	rdb := redis_client.InitRedisClient()
	defer rdb.Client.Close()

	if err := rdb.Client.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("FATAL: Redis connection failed: %v", err)
	}

	// ==========================================
	// 2. THE RATE HUB INITIALIZATION (SINGLETON)
	// ==========================================
	rateHub := rates_api.NewRateHub()

	// You MUST start the Hub in a background Goroutine so it listens to Redis forever
	go rateHub.Start(ctx)

	// 4. Build the Fiber app with every route (shared with the integration tests).
	app := server.NewApp(rateHub)

	// 5. Swagger API Docs in Non-Production
	if env.Env.APP_ENV == env.APP_ENV_DEVELOP || env.Env.APP_ENV == env.APP_ENV_LOCAL || env.Env.APP_ENV == env.APP_ENV_STAGING {
		setupSwagger(app)
		log.Println("📚 Swagger UI is available at /docs")
	}

	// 7. Start Background Workers
	log.Println("🚀 Starting background event consumer, outbox recovery, and hedging cron...")
	go workers.StartEventConsumer(ctx)
	go workers.StartOutboxRecoveryCron(ctx)
	go workers.StartHedgingCron(ctx)
	go workers.StartPartitionCron(ctx)

	// 8. Start the Server in a Goroutine
	go func() {
		port := env.GetServerPort(env.PORT_KEY)
		log.Println("✅ Fiber Server listening on port", port)
		if err := app.Listen(":" + port); err != nil {
			log.Fatalf("FATAL: Server crashed: %v", err)
		}
	}()
	// ==========================================
	// 🛠️ LOCAL DEV ROUTE PRINTER
	// ==========================================
	if env.Env.APP_ENV == env.APP_ENV_DEVELOP || env.Env.APP_ENV == env.APP_ENV_LOCAL {
		time.Sleep(100 * time.Millisecond) // Give the server a split-second to boot
		log.Println("\n==================================================")
		log.Println("🚀 REGISTERED API ROUTES:")
		log.Println("==================================================")

		// app.GetRoutes(true) filters out auto-generated HEAD/OPTIONS routes
		for _, route := range app.GetRoutes(true) {
			// CRITICAL FIX: Skip auto-generated HEAD routes to keep the terminal clean
			if route.Method == fiber.MethodHead {
				continue
			}
			// Format with padding so the methods and paths align perfectly
			log.Printf("🔹 %-7s %s\n", route.Method, route.Path)
		}
		log.Println("==================================================")
	}
	// 8. Block main thread until OS (or OTA Updater) sends a termination signal
	<-ctx.Done()

	log.Println("🛑 Shutting down Fiber server gracefully...")

	// Fiber v3 handles graceful connection draining perfectly
	if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("✅ Server exited safely.")
}
