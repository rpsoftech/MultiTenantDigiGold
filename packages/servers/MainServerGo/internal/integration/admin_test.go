//go:build integration

package integration

import (
	"net/http"
	"testing"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
)

func TestReversal_ReturnsGoldOnceOnly(t *testing.T) {
	before := balance(t, database.SeedVerifiedCustomerUUID)
	trade := counterBuy(t, database.SeedVerifiedCustomerUUID, 1.5)
	ledgerUUID := str(trade["gl_uuid"])

	r := call(t, "POST", "/admin/store/ledger/reverse", demoManager(t), database.SeedDemoTenantUUID,
		map[string]string{"ledger_uuid": ledgerUUID})
	expectStatus(t, r, http.StatusOK)
	expectGrams(t, "balance after reversal", balance(t, database.SeedVerifiedCustomerUUID), before)

	again := call(t, "POST", "/admin/store/ledger/reverse", demoManager(t), database.SeedDemoTenantUUID,
		map[string]string{"ledger_uuid": ledgerUUID})
	expectError(t, again, http.StatusConflict, "ERROR_LEDGER_REVERSAL")
}

func TestTenantIsolation(t *testing.T) {
	otherManager := adminToken(t, database.SeedOtherManagerUsername, database.SeedOtherTenantUUID)
	platformAdmin := adminToken(t, database.SeedPlatformAdminUsername, database.SeedPlatformTenantUUID)

	t.Run("store manager cannot open another store", func(t *testing.T) {
		r := call(t, "GET", "/admin/store/ledger", otherManager, database.SeedDemoTenantUUID, nil)
		expectError(t, r, http.StatusForbidden, "TENANT_MISMATCH")
	})
	t.Run("store manager cannot manage tenants", func(t *testing.T) {
		r := call(t, "GET", "/admin/tenants", demoManager(t), database.SeedDemoTenantUUID, nil)
		expectStatus(t, r, http.StatusForbidden)
	})
	t.Run("store manager cannot collect another store's redemption", func(t *testing.T) {
		counterBuy(t, database.SeedVerifiedCustomerUUID, 0.5)
		rr := requestRedemption(t, verifiedCustomer(t), 0.1)
		r := call(t, "POST", "/admin/store/redemptions/collect", otherManager, database.SeedOtherTenantUUID,
			map[string]string{"redemption_uuid": str(rr["redemption_uuid"]), "pickup_code": str(rr["pickup_code"])})
		expectError(t, r, http.StatusNotFound, "REDEMPTION_NOT_FOUND")
	})
	t.Run("customer token cannot be used on another store", func(t *testing.T) {
		r := call(t, "GET", "/user/portfolio", verifiedCustomer(t), database.SeedOtherTenantUUID, nil)
		expectError(t, r, http.StatusForbidden, "TENANT_MISMATCH")
	})
	t.Run("platform admin can open any store", func(t *testing.T) {
		r := call(t, "GET", "/admin/store/ledger", platformAdmin, database.SeedDemoTenantUUID, nil)
		expectStatus(t, r, http.StatusOK)
	})
}

func TestEventPartitionsExistForThisMonth(t *testing.T) {
	name := "system_events_" + time.Now().Format("2006_01")
	var exists bool
	if err := db.QueryRow(`SELECT to_regclass($1) IS NOT NULL`, name).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if !exists {
		t.Fatalf("partition %s is missing", name)
	}
}
