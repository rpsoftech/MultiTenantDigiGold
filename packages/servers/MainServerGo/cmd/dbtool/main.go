// dbtool manages the DigiGold database schema and local seed data.
//
//	go run ./cmd/dbtool migrate up          apply all pending migrations
//	go run ./cmd/dbtool migrate down 1      revert the last migration
//	go run ./cmd/dbtool migrate version     print the current schema version
//	go run ./cmd/dbtool migrate force 1     mark version 1 as clean after a manual fix
//	go run ./cmd/dbtool seed                insert demo tenants, admins and customers
//	go run ./cmd/dbtool bootstrap           create the platform tenant and first super_admin
//	                                        (safe in PRODUCTION; needs BOOTSTRAP_ADMIN_*)
//
// It reads the same env file and variables as the API (digiGold.env).
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

const usage = `usage:
  dbtool migrate up | down <steps> | version | force <version>
  dbtool seed
  dbtool bootstrap   (BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PHONE, BOOTSTRAP_ADMIN_PASSWORD)`

func main() {
	log.SetOutput(os.Stdout)
	if len(os.Args) < 2 {
		fail(usage)
	}
	env.LoadEnv("digiGold.env")

	switch os.Args[1] {
	case "migrate":
		runMigrate(os.Args[2:])
	case "seed":
		runSeed()
	case "bootstrap":
		runBootstrap()
	default:
		fail(usage)
	}
}

func runMigrate(args []string) {
	sqlDB := postgres.GetPostgresDB().Db
	if len(args) == 0 {
		fail(usage)
	}
	switch args[0] {
	case "up":
		must(database.MigrateUp(sqlDB))
	case "down":
		must(database.MigrateDown(sqlDB, intArg(args, 1)))
		log.Println("✅ Reverted", intArg(args, 1), "migration(s)")
	case "version":
		version, dirty, err := database.MigrateVersion(sqlDB)
		must(err)
		fmt.Printf("version=%d dirty=%t\n", version, dirty)
	case "force":
		must(database.MigrateForce(sqlDB, intArg(args, 1)))
		log.Println("✅ Forced schema version", intArg(args, 1))
	default:
		fail(usage)
	}
}

func runSeed() {
	if env.Env.APP_ENV == env.APP_ENV_PRODUCTION {
		fail("refusing to seed demo data into a PRODUCTION database")
	}
	ctx := context.Background()
	db := postgres.GetPostgresDB().Db
	must(database.MigrateUp(db))
	must(database.Seed(ctx, db, redis_client.InitRedisClient().Client, database.SeedOptions{
		AdminPassword:         envOr("SEED_ADMIN_PASSWORD", "DigiGold@123"),
		AdminTOTPSecret:       envOr("SEED_ADMIN_TOTP_SECRET", "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"),
		RazorpayKeyID:         envOr("SEED_RAZORPAY_KEY_ID", "rzp_test_placeholder"),
		RazorpayKeySecret:     envOr("SEED_RAZORPAY_KEY_SECRET", "placeholder_key_secret"),
		RazorpayWebhookSecret: envOr("SEED_RAZORPAY_WEBHOOK_SECRET", "placeholder_webhook_secret"),
	}))
}

// runBootstrap prepares an empty database for real use (no demo data). The password is
// read from the environment and never printed; unset BOOTSTRAP_ADMIN_PASSWORD afterwards.
func runBootstrap() {
	db := postgres.GetPostgresDB().Db
	must(database.MigrateUp(db))
	result, err := database.Bootstrap(context.Background(), db, database.BootstrapOptions{
		AdminUsername: os.Getenv("BOOTSTRAP_ADMIN_USERNAME"),
		AdminPhone:    os.Getenv("BOOTSTRAP_ADMIN_PHONE"),
		AdminPassword: os.Getenv("BOOTSTRAP_ADMIN_PASSWORD"),
	})
	must(err)

	log.Printf("✅ Platform tenant %s (%s)", result.PlatformTenantUUID, map[bool]string{true: "created", false: "already existed"}[result.TenantCreated])
	if result.AdminCreated {
		log.Println("✅ super_admin created: sign in with X-Tenant-ID set to the platform tenant UUID above, then set up TOTP")
	} else {
		log.Println("ℹ️ The platform already has a super_admin; none was created")
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func intArg(args []string, i int) int {
	if len(args) <= i {
		fail(usage)
	}
	n, err := strconv.Atoi(args[i])
	if err != nil || n < 0 {
		fail(usage)
	}
	return n
}

func must(err error) {
	if err != nil {
		fail(err.Error())
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(1)
}
