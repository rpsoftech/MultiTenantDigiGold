//go:build integration

// Package integration drives the real DigiGold API in-process against a real
// PostgreSQL and Redis, with a fake Razorpay server.
//
// Run (needs PostgreSQL 18 and Redis, e.g. `docker compose up -d db redis`):
//
//	go test -tags=integration -count=1 ./internal/integration/...
//
// The tests WIPE the database named by PG_DATABASE (default digigold_test) and
// the Redis DB named by REDIS_DB_DATABASE (default 15). As a safety guard they
// refuse to run unless PG_DATABASE ends in "_test" and REDIS_DB_DATABASE is "15".
package integration

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/redis/go-redis/v9"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	rates_api "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/rates"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/server"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

const (
	adminPassword   = "Test@Password123"
	adminTOTPSecret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"
	webhookSecret   = "test_webhook_secret"
)

// Shared state for every test in the package.
var (
	app      *fiber.App
	db       *sql.DB
	rdb      *redis.Client
	razorpay *fakeRazorpay
)

// defaults match docker-compose.yml, so the tests run against it with no setup.
var defaults = map[string]string{
	"APP_ENV":               "CI",
	"PORT":                  "8089",
	"ACCESS_TOKEN_KEY":      strings.Repeat("a", 120),
	"REFRESH_TOKEN_KEY":     strings.Repeat("r", 120),
	"PG_HOST":               "127.0.0.1",
	"PG_PORT":               "5432",
	"PG_USERNAME":           "admin",
	"PG_PASSWORD":           "adminpassword",
	"PG_DATABASE":           "digigold_test",
	"PG_SCHEMA":             "public",
	"REDIS_DB_HOST":         "127.0.0.1",
	"REDIS_DB_PORT":         "6379",
	"REDIS_DB_PASSWORD":     "localredispass",
	"REDIS_DB_DATABASE":     "15",
	"REDIS_DEFAULT_KEY":     "digiGoldTest:",
	"REDIS_DEFAULT_CHANNEL": "digiGoldTest:",
}

func TestMain(m *testing.M) {
	for k, v := range defaults {
		if os.Getenv(k) == "" {
			os.Setenv(k, v)
		}
	}
	if !strings.HasSuffix(os.Getenv("PG_DATABASE"), "_test") || os.Getenv("REDIS_DB_DATABASE") != "15" {
		log.Fatal("refusing to run: integration tests wipe data; use a PG_DATABASE ending in _test and REDIS_DB_DATABASE=15")
	}

	razorpay = newFakeRazorpay()
	defer razorpay.Close()
	os.Setenv("RAZORPAY_BASE_URL", razorpay.URL)

	if err := createTestDatabase(); err != nil {
		log.Fatalf("create test database: %v", err)
	}

	env.LoadEnv("digiGold.env") // the file is optional; the variables above are used
	db = postgres.GetPostgresDB().Db
	rdb = redis_client.InitRedisClient().Client
	ctx := context.Background()

	if err := resetDatabase(ctx); err != nil {
		log.Fatalf("reset database: %v", err)
	}
	if err := database.MigrateUp(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := rdb.FlushDB(ctx).Err(); err != nil {
		log.Fatalf("flush redis: %v", err)
	}
	if err := database.Seed(ctx, db, rdb, database.SeedOptions{
		AdminPassword:         adminPassword,
		AdminTOTPSecret:       adminTOTPSecret,
		RazorpayKeyID:         "rzp_test_key",
		RazorpayKeySecret:     "rzp_test_secret",
		RazorpayWebhookSecret: webhookSecret,
	}); err != nil {
		log.Fatalf("seed: %v", err)
	}

	hubCtx, stopHub := context.WithCancel(ctx)
	rateHub := rates_api.NewRateHub()
	go rateHub.Start(hubCtx)
	app = server.NewApp(rateHub)

	code := m.Run()
	stopHub()
	os.Exit(code)
}

// createTestDatabase creates PG_DATABASE if it does not exist yet.
func createTestDatabase() error {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/postgres?sslmode=disable",
		os.Getenv("PG_USERNAME"), os.Getenv("PG_PASSWORD"), os.Getenv("PG_HOST"), os.Getenv("PG_PORT"))
	admin, err := sql.Open("pgx", dsn)
	if err != nil {
		return err
	}
	defer admin.Close()

	name := os.Getenv("PG_DATABASE")
	var exists bool
	if err := admin.QueryRow(`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, name).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}
	_, err = admin.Exec(fmt.Sprintf(`CREATE DATABASE %q`, name))
	return err
}

// resetDatabase drops every object so each run starts from migration 1.
func resetDatabase(ctx context.Context) error {
	schema := os.Getenv("PG_SCHEMA")
	_, err := db.ExecContext(ctx, fmt.Sprintf(`DROP SCHEMA IF EXISTS %q CASCADE; CREATE SCHEMA %q;`, schema, schema))
	return err
}
