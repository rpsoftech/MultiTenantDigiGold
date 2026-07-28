package repository

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

// TestMain acts as the global setup/teardown for this test package.
func TestMain(m *testing.M) {
	// 1. BLUNT TRUTH: Force the environment to a TEST configuration.
	// You must configure your env package to load a .env.test file here,
	// otherwise you will accidentally truncate your production database.
	os.Setenv("APP_ENV", "test")
	os.Setenv("MYSQL_DATABASE_KEY", "digigold_test") // Or whatever your env keys are
	os.Setenv("REDIS_DB_DATABASE_KEY", "1")          // Use a separate Redis DB index for tests (e.g., 1 instead of 0)

	// 2. Initialize Singletons (These will panic if the test DB is offline, which is what we want)
	postgres.GetPostgresDB()
	redis_client.InitRedisClient()

	// 3. Initialize the Repository (Pre-compiles statements against the test DB)
	GetTenantRepository()

	// 4. Run the tests
	code := m.Run()

	// 5. Teardown: Clean up the test databases
	cleanupTestDatabases()

	os.Exit(code)
}

func cleanupTestDatabases() {
	db := postgres.GetPostgresDB().Db
	// DANGER: Only run this on a dedicated test database!
	_, _ = db.Exec("TRUNCATE TABLE tenants CASCADE;")

	rdb := redis_client.InitRedisClient().Client
	_ = rdb.FlushDB(context.Background())
}

// ==========================================
// THE TESTS
// ==========================================

func TestTenantRepository_CreateAndGet(t *testing.T) {
	repo := GetTenantRepository()
	ctx := context.Background()

	// 1. Setup Mock Tenant Data
	tenantUUID := uuid.New().String()
	domain := "testshop.com"
	shortName := "testshop"

	newTenant := &models.Tenant{
		UUID:             tenantUUID,
		FullName:         "Test Shop Ltd",
		ShortName:        &shortName,
		Domain:           &domain,
		KYCMode:          "strict",
		MarkupPercentage: 2.50,
		UIJSONConfig:     []byte(`{"theme": "dark"}`),
	}

	// 2. Test Create
	err := repo.CreateFullTenant(ctx, newTenant)
	require.NoError(t, err, "Failed to create tenant")
	require.NotZero(t, newTenant.ID, "Internal ID should have been populated by RETURNING clause")
	require.False(t, newTenant.CreatedAt.IsZero(), "CreatedAt should be populated")

	// BLUNT TRUTH: We must sleep to let the background Goroutine finish writing to Redis.
	// In a test environment, 50ms is usually enough.
	time.Sleep(50 * time.Millisecond)

	// 3. Test Get Full (Cache Hit)
	fetchedFull, err := repo.GetFullTenantByUUID(ctx, tenantUUID)
	require.NoError(t, err)
	assert.Equal(t, "Test Shop Ltd", fetchedFull.FullName)
	assert.Equal(t, "strict", fetchedFull.KYCMode)

	// Verify pointers correctly unpacked
	require.NotNil(t, fetchedFull.Domain)
	assert.Equal(t, domain, *fetchedFull.Domain)

	// 4. Test Get Partial by Domain
	fetchedPartial, err := repo.GetPartialTenantByDomain(ctx, domain)
	require.NoError(t, err)
	assert.Equal(t, tenantUUID, fetchedPartial.UUID)
	assert.Equal(t, 2.50, fetchedPartial.MarkupPercentage)

	// In partial, CreatedAt should be the Go zero value because we don't SELECT it
	assert.True(t, fetchedPartial.CreatedAt.IsZero(), "Partial fetch should not populate CreatedAt")
}

func TestTenantRepository_Update(t *testing.T) {
	repo := GetTenantRepository()
	ctx := context.Background()

	// 1. Create initial tenant
	tenantUUID := uuid.New().String()
	domain := "updateshop.com"

	tenant := &models.Tenant{
		UUID:             tenantUUID,
		FullName:         "Original Name",
		Domain:           &domain,
		KYCMode:          "relaxed",
		MarkupPercentage: 1.0,
		UIJSONConfig:     []byte(`{}`),
	}

	err := repo.CreateFullTenant(ctx, tenant)
	require.NoError(t, err)

	// Wait for cache write
	time.Sleep(50 * time.Millisecond)

	// 2. Modify properties
	tenant.FullName = "Updated Name"
	tenant.KYCMode = "strict"
	tenant.MarkupPercentage = 5.0

	// 3. Test Update
	err = repo.UpdateFullTenant(ctx, tenant)
	require.NoError(t, err)
	require.False(t, tenant.ModifiedAt.IsZero(), "ModifiedAt should be updated by Postgres")

	// Wait for cache invalidation goroutine to finish removing the keys
	time.Sleep(50 * time.Millisecond)

	// 4. Fetch to ensure DB actually saved it and cache miss worked
	updatedTenant, err := repo.GetFullTenantByUUID(ctx, tenantUUID)
	require.NoError(t, err)
	assert.Equal(t, "Updated Name", updatedTenant.FullName)
	assert.Equal(t, "strict", updatedTenant.KYCMode)
	assert.Equal(t, 5.0, updatedTenant.MarkupPercentage)
}

func TestTenantRepository_NilPointers(t *testing.T) {
	repo := GetTenantRepository()
	ctx := context.Background()

	// Test creating a tenant with NO domain or shortname (nulls in DB)
	tenantUUID := uuid.New().String()

	tenant := &models.Tenant{
		UUID:             tenantUUID,
		FullName:         "No Domain Shop",
		Domain:           nil, // Explicitly nil
		ShortName:        nil, // Explicitly nil
		KYCMode:          "none",
		MarkupPercentage: 0.0,
		UIJSONConfig:     []byte(`{}`),
	}

	err := repo.CreateFullTenant(ctx, tenant)
	require.NoError(t, err, "Should not panic when creating with nil pointers")

	// Wait for cache
	time.Sleep(50 * time.Millisecond)

	// Fetch it back
	fetched, err := repo.GetFullTenantByUUID(ctx, tenantUUID)
	require.NoError(t, err)
	assert.Nil(t, fetched.Domain, "Domain should remain nil")
	assert.Nil(t, fetched.ShortName, "ShortName should remain nil")
}
