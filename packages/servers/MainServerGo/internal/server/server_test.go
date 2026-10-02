package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/env"
)

func TestAdminPreflightAllowsAuthenticationHeaders(t *testing.T) {
	app := fiber.New()
	app.Use(corsMiddleware())
	app.Post("/api/v1/admin/tenants", func(c fiber.Ctx) error {
		return c.SendStatus(http.StatusUnauthorized)
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/admin/tenants", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "content-type, x-tenant-id, "+strings.ToLower(env.XApiToken))

	res, err := app.Test(req)
	if err != nil {
		t.Fatalf("preflight request failed: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want %d", res.StatusCode, http.StatusNoContent)
	}
	if origin := res.Header.Get("Access-Control-Allow-Origin"); origin != "*" {
		t.Errorf("allowed origin = %q, want existing wildcard policy", origin)
	}

	allowedHeaders := make(map[string]bool)
	for _, header := range strings.Split(res.Header.Get("Access-Control-Allow-Headers"), ",") {
		allowedHeaders[strings.ToLower(strings.TrimSpace(header))] = true
	}
	for _, header := range []string{"Content-Type", "X-Tenant-Id", env.XApiToken} {
		if !allowedHeaders[strings.ToLower(header)] {
			t.Errorf("CORS preflight does not allow %s", header)
		}
	}
	if methods := res.Header.Get("Access-Control-Allow-Methods"); !strings.Contains(methods, http.MethodPost) {
		t.Errorf("CORS preflight does not allow POST: %q", methods)
	}
}
