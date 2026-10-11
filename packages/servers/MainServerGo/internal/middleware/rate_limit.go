package middleware

import (
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
)

// AuthRateLimiter throttles credential endpoints (OTP request/verify, admin
// password and TOTP) per client IP and route, to slow down brute force and
// OTP/WhatsApp cost abuse. Storage is in-memory, so the limit applies per
// API instance.
func AuthRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        10,
		Expiration: time.Minute,
		KeyGenerator: func(c fiber.Ctx) string {
			return c.IP() + "|" + c.Path()
		},
		LimitReached: rateLimited,
	})
}

// PickupCollectRateLimiter caps pickup-code attempts per staff login across all pickups,
// on top of the per-pickup lock after five wrong codes, so codes can't be sprayed across
// many pickups. Runs after admin authentication, which provides the admin UUID.
func PickupCollectRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        30,
		Expiration: time.Minute,
		KeyGenerator: func(c fiber.Ctx) string {
			return GetAdminUUID(c) + "|pickup-collect"
		},
		LimitReached: rateLimited,
	})
}

func rateLimited(c fiber.Ctx) error {
	return &interfaces.RequestError{
		StatusCode: fiber.StatusTooManyRequests,
		Code:       interfaces.ERROR_TOO_MANY_ATTEMPTS,
		Name:       "RATE_LIMITED",
		Message:    "Too many requests. Please try again in a minute.",
	}
}
