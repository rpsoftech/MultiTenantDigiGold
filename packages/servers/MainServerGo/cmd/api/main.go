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
	auth_controllers "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/auth"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/updater"
)

var version string = "0" // Injected by deploy script

func main() {
	env.LoadEnv("digiGold.env")
	log.Println("🚀 Booting Digi Gold HTTP API Server (Fiber v3)...")

	// 1. Move the termination channel to the top so our background workers can trigger a restart
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	// 2. The 5-Minute OTA Updater Daemon
	if env.Env.APP_ENV == env.APP_ENV_PRODUCTION || env.Env.APP_ENV == env.APP_ENV_STAGING {
		go func(versionStr string, stopChan chan<- os.Signal) {
			currentVersion, _ := strconv.Atoi(versionStr)
			// Define the check logic
			runCheck := func() {
				updated, err := updater.CheckAndUpdate(string(env.Env.APP_ENV), "https://keyvalue.rpso.in/public/", "api", currentVersion)
				if err != nil {
					log.Printf("⚠️ OTA Updater: %v\n", err)
					return
				}

				// If a new binary was downloaded and replaced, trigger a graceful restart!
				if updated {
					log.Println("🔄 OTA Update applied successfully! Triggering graceful restart...")
					stopChan <- syscall.SIGTERM
				}
			}

			// Run immediately on boot
			runCheck()

			// Schedule to run exactly every 5 minutes
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()

			for range ticker.C {
				runCheck()
			}
		}(version, quit)
	}
	// 3. Pre-flight Infrastructure Checks
	db := postgres.GetPostgresDB()
	if err := db.Db.Ping(); err != nil {
		log.Fatalf("FATAL: PostgreSQL connection failed: %v", err)
	}
	rdb := redis_client.InitRedisClient()
	if err := rdb.Client.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("FATAL: Redis connection failed: %v", err)
	}

	// 4. Initialize Fiber App with Strict Timeouts
	app := fiber.New(fiber.Config{
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		AppName:      "Digi Gold API v1",
		ErrorHandler: middleware.GlobalErrorHandler, // Centralized Error Handling
	})

	// 5. Initialize Controllers
	authController := auth_controllers.NewAuthController()

	// 6. Setup Route Groups & Apply Tenancy Middleware
	api := app.Group("/api/v1")
	// The middleware is attached to the /auth group, protecting everything inside it
	auth := api.Group("/auth", middleware.TenantInterceptor)
	authController.RegisterRoutes(auth)
	// 7. Start the Server in a Goroutine
	go func() {
		port := env.GetServerPort(env.PORT_KEY)
		log.Println("✅ Fiber Server listening on port", port)
		if err := app.Listen(":" + port); err != nil {
			log.Fatalf("FATAL: Server crashed: %v", err)
		}
	}()

	// 8. Block main thread until OS (or OTA Updater) sends a termination signal
	<-quit

	log.Println("🛑 Shutting down Fiber server gracefully...")

	// Fiber v3 handles graceful connection draining perfectly
	if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("✅ Server exited safely.")
}
