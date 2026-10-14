// dbtool manages the DigiGold database schema and local seed data.
//
//	go run ./cmd/dbtool migrate up          apply all pending migrations
//	go run ./cmd/dbtool migrate down 1      revert the last migration
//	go run ./cmd/dbtool migrate version     print the current schema version
//	go run ./cmd/dbtool migrate force 1     mark version 1 as clean after a manual fix
//	go run ./cmd/dbtool reset               drop everything, create the schema again and clear
//	                                        the app's Redis keys (not in PRODUCTION)
//	go run ./cmd/dbtool seed                load the mock data (internal/database/mock_data.sql)
//	                                        and a starting gold rate (not in PRODUCTION)
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
  dbtool reset
  dbtool seed        (optional SEED_RAZORPAY_KEY_ID, SEED_RAZORPAY_KEY_SECRET, SEED_RAZORPAY_WEBHOOK_SECRET)
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
	case "reset":
		runReset()
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

// runReset empties a non-production database: there is no data worth keeping yet, so the
// schema is changed by editing migrations/000001_init.up.sql and resetting (see migrations.go).
func runReset() {
	if env.Env.APP_ENV == env.APP_ENV_PRODUCTION {
		fail("refusing to reset a PRODUCTION database")
	}
	ctx := context.Background()
	db := postgres.GetPostgresDB().Db
	must(database.ResetSchema(ctx, db, env.Env.GetEnv(env.PG_SCHEMA_KEY)))
	must(database.MigrateUp(db))

	rc := redis_client.InitRedisClient()
	deleted, err := database.ClearCachedKeys(ctx, rc.Client, rc.GetRedisKey(""))
	must(err)
	log.Printf("✅ Database reset to an empty schema; %d cached Redis keys deleted", deleted)
	log.Println("ℹ️ Restart the API and worker (they keep tenant IDs in memory), then run `dbtool seed` for mock data")
}

// runSeed loads the mock data (stores, staff, customers, trades, pickups) and a starting
// gold rate. Loading it twice changes nothing.
func runSeed() {
	if env.Env.APP_ENV == env.APP_ENV_PRODUCTION {
		fail("refusing to seed demo data into a PRODUCTION database")
	}
	ctx := context.Background()
	db := postgres.GetPostgresDB().Db
	must(database.MigrateUp(db))
	must(database.LoadMockData(ctx, db))

	// Real Razorpay test keys, for checkout, come from the environment so they never live in
	// the repository; without them the stores keep placeholder keys.
	keyID, keySecret, webhookSecret := os.Getenv("SEED_RAZORPAY_KEY_ID"), os.Getenv("SEED_RAZORPAY_KEY_SECRET"), os.Getenv("SEED_RAZORPAY_WEBHOOK_SECRET")
	switch {
	case keyID != "" && keySecret != "" && webhookSecret != "":
		must(database.SetMockPaymentKeys(ctx, db, keyID, keySecret, webhookSecret))
		log.Println("✅ Mock stores use the Razorpay test keys from SEED_RAZORPAY_*")
	case keyID != "" || keySecret != "" || webhookSecret != "":
		fail("set all of SEED_RAZORPAY_KEY_ID, SEED_RAZORPAY_KEY_SECRET and SEED_RAZORPAY_WEBHOOK_SECRET, or none")
	}

	must(database.SeedLiveRate(ctx, redis_client.InitRedisClient().Client))
	log.Println("✅ Mock data loaded. Admins sign in with password DigiGold@123 and TOTP secret JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP")
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
