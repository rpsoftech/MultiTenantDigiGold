package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v3"

	auth_controllers "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/auth"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

func main() {
	log.Println("🚀 Booting Digi Gold HTTP API Server (Fiber v3)...")

	// 1. Pre-flight Infrastructure Checks
	db := postgres.GetPostgresDB()
	if err := db.Db.Ping(); err != nil {
		log.Fatalf("FATAL: PostgreSQL connection failed: %v", err)
	}
	rdb := redis_client.InitRedisClient()
	if err := rdb.Client.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("FATAL: Redis connection failed: %v", err)
	}

	// 2. Initialize Fiber App with Strict Timeouts
	app := fiber.New(fiber.Config{
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		AppName:      "Digi Gold API v1",
	})

	// 3. Initialize Controllers
	authController := auth_controllers.NewAuthController()

	// 4. Setup Route Groups & Apply Tenancy Middleware
	api := app.Group("/api/v1")

	// The middleware is attached to the /auth group, protecting everything inside it
	auth := api.Group("/auth", middleware.TenantInterceptor)

	// Route: POST /api/v1/auth/otp/request
	auth.Post("/otp/request", authController.RequestOTP)

	// 5. Start the Server in a Goroutine
	go func() {
		log.Println("✅ Fiber Server listening on port 8080")
		if err := app.Listen(":8080"); err != nil {
			log.Fatalf("FATAL: Server crashed: %v", err)
		}
	}()

	// 6. Graceful Shutdown (Wait for OS Interrupt)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down Fiber server gracefully...")

	// Fiber v3 handles graceful connection draining perfectly
	if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("✅ Server exited safely.")
}
