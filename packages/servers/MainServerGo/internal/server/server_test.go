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

func TestCORSUsesConfiguredOrigins(t *testing.T) {
	t.Setenv(corsAllowOriginsKey, "https://admin.example.com, https://shop.example.com")
	app := fiber.New()
	app.Use(corsMiddleware())
	app.Get("/api/v1/tenant/info", func(c fiber.Ctx) error { return c.SendStatus(http.StatusOK) })

	allowedOrigin := func(origin string) string {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/tenant/info", nil)
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", http.MethodGet)
		res, err := app.Test(req)
		if err != nil {
			t.Fatalf("preflight request failed: %v", err)
		}
		defer res.Body.Close()
		return res.Header.Get("Access-Control-Allow-Origin")
	}

	if got := allowedOrigin("https://shop.example.com"); got != "https://shop.example.com" {
		t.Errorf("configured origin allowed as %q, want it echoed back", got)
	}
	if got := allowedOrigin("https://evil.example.com"); got != "" {
		t.Errorf("unlisted origin allowed as %q, want none", got)
	}
}

func TestCheckCORSConfigRequiresOriginsInProduction(t *testing.T) {
	cases := []struct {
		appEnv  env.AppEnv
		value   string
		wantErr bool
	}{
		{env.APP_ENV_LOCAL, "", false},
		{env.APP_ENV_STAGING, "", false},
		{env.APP_ENV_PRODUCTION, "", true},
		{env.APP_ENV_PRODUCTION, " , ", true},
		{env.APP_ENV_PRODUCTION, "*", true},
		{env.APP_ENV_PRODUCTION, "https://shop.example.com,*", true},
		{env.APP_ENV_PRODUCTION, "https://shop.example.com, https://admin.example.com", false},
	}
	for _, c := range cases {
		if err := CheckCORSConfig(c.appEnv, c.value); (err != nil) != c.wantErr {
			t.Errorf("CheckCORSConfig(%s, %q) = %v, want error %v", c.appEnv, c.value, err, c.wantErr)
		}
	}
}

// A value read from a request and kept after the handler returns (as PublishAsync and the
// tenant caches do) must not change when later requests reuse the request buffer.
func TestRequestValuesSurviveTheRequest(t *testing.T) {
	if !appConfig().Immutable {
		t.Fatal("appConfig must set Immutable: request values are used after the handler returns")
	}

	app := fiber.New(appConfig())
	var kept []string
	app.Get("/", func(c fiber.Ctx) error {
		kept = append(kept, c.Get("X-Tenant-ID"))
		return c.SendStatus(http.StatusOK)
	})

	want := []string{
		"01900000-0000-7000-8000-000000000001",
		"01900000-0000-7000-8000-000000000002",
		"01900000-0000-7000-8000-000000000003",
	}
	for _, tenant := range want {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("X-Tenant-ID", tenant)
		res, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		res.Body.Close()
	}
	for i, got := range kept {
		if got != want[i] {
			t.Fatalf("value kept from request %d = %q, want %q", i+1, got, want[i])
		}
	}
}
