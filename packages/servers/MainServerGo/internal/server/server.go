// Package server builds the DigiGold HTTP application. cmd/api serves it and
// the integration tests drive it in-process.
package server

import (
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"

	admin_controllers "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/admin"
	auth_controllers "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/auth"
	rates_api "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/rates"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/api/tenant"
	trade_api "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/trade"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
)

// NewApp returns the Fiber app with all middleware and routes registered.
// PostgreSQL, Redis and the env must already be initialised.
func NewApp(rateHub *rates_api.RateHub) *fiber.App {
	app := fiber.New(fiber.Config{
		ReadTimeout: 5 * time.Second,
		// WriteTimeout: 10 * time.Second,
		WriteTimeout: 0, // Set to 0 for persistent SSE streaming connections!
		AppName:      "Digi Gold API v1",
		ErrorHandler: middleware.GlobalErrorHandler, // Centralized Error Handling
		TrustProxy:   true,
		ProxyHeader:  fiber.HeaderXForwardedFor,
		TrustProxyConfig: fiber.TrustProxyConfig{
			Loopback: true, // True if Nginx is on 127.0.0.1
		},
	})

	// Add OpenTelemetry Tracing Middleware
	app.Use(recover.New(recover.Config{
		EnableStackTrace: true,
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"}, // Replace with your frontend domains in prod
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Tenant-Id"},
	}))

	app.Use(middleware.OtelInterceptor)

	app.Use(logger.New(logger.Config{
		// Define your exact output log format using Fiber v3 tags
		Format: "${time} | ${status} | ${latency} | ${ip} | ${method} | ${path}\n",
		// X-Real-IP
		// Optional: Customize the time format
		TimeFormat: "2006-01-02 15:04:05",
		// Optional: Define a timezone
		TimeZone: "Local",
	}))
	// 5. Initialize Controllers
	authController := auth_controllers.NewAuthController()

	// 6. Setup Route Groups & Apply Tenancy Middleware
	api := app.Group("/api/v1")
	// The middleware is attached to the /auth group, protecting everything inside it
	auth := api.Group("/auth", middleware.AuthRateLimiter(), middleware.TenantInterceptor)
	authController.RegisterRoutes(auth)

	// Rates Route (Public Stream)
	rateController := rates_api.NewRateController(rateHub)
	ratesGroup := api.Group("/rates")
	rateController.RegisterRoutes(ratesGroup)

	// Admin Routes
	// Note: auth/* is public (login, totp/setup, totp/verify — no JWT required)
	//       tenants/* is guarded inside RegisterRoutes via TenantInterceptor + AdminJWTMiddleware + RequireRole
	adminGroup := api.Group("/admin")
	adminAuthController := admin_controllers.NewAdminAuthController()
	adminAuthController.RegisterRoutes(adminGroup)

	adminTenantController := admin_controllers.NewAdminTenantController()
	adminTenantController.RegisterRoutes(adminGroup)

	adminUserController := admin_controllers.NewAdminUserController()
	adminUserController.RegisterRoutes(adminGroup)

	adminEventsController := admin_controllers.NewAdminEventsController()
	adminEventsController.RegisterRoutes(adminGroup)

	adminStoreController := admin_controllers.NewAdminStoreController()
	adminStoreController.RegisterRoutes(adminGroup)

	// Customer Routes
	// Middleware is attached to the /trade and /user groups only. Attaching it to
	// a "/" group would also run it on every route registered later under /api/v1
	// (webhook, tenant info) and reject them with 401.
	customerTradeController := trade_api.NewCustomerTradeController(rateHub)
	customerTradeController.RegisterRoutes(api, middleware.TenantInterceptor, middleware.GetAuthMiddleware().Intercept)

	tenantController := tenant.NewTenantController()
	tenantController.RegisterRoutes(api)

	// Webhooks (Public)
	webhookController := trade_api.NewWebhookController()
	webhookController.RegisterRoutes(api)

	return app
}
