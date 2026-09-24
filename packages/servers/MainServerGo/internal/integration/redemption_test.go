//go:build integration

package integration

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
)

// requestRedemption asks to collect grams at the counter and returns the redemption.
func requestRedemption(t *testing.T, token string, grams float64) map[string]any {
	t.Helper()
	r := call(t, "POST", "/trade/redeem", token, database.SeedDemoTenantUUID, map[string]any{"weight_grams": grams})
	expectStatus(t, r, http.StatusOK)
	rr, _ := r.Body["redemption"].(map[string]any)
	if str(rr["status"]) != "PENDING" || len(str(rr["pickup_code"])) != 6 {
		t.Fatalf("redemption = %v, want PENDING with a 6-digit pickup code", rr)
	}
	return rr
}

func collect(t *testing.T, redemptionUUID, code string) response {
	t.Helper()
	return call(t, "POST", "/admin/store/redemptions/collect", demoManager(t), database.SeedDemoTenantUUID,
		map[string]string{"redemption_uuid": redemptionUUID, "pickup_code": code})
}

// The main flow: request in the app, staff find it at the counter, the code hands it over.
func TestRedemption_CollectAtCounterWithPickupCode(t *testing.T) {
	counterBuy(t, database.SeedVerifiedCustomerUUID, 2)
	before := balance(t, database.SeedVerifiedCustomerUUID)

	rr := requestRedemption(t, verifiedCustomer(t), 1)
	id, code := str(rr["redemption_uuid"]), str(rr["pickup_code"])

	// The gold is reserved (debited) as soon as the request is made.
	expectGrams(t, "balance after request", balance(t, database.SeedVerifiedCustomerUUID), before-1)

	// Staff find the request by phone, without seeing the pickup code.
	pending := call(t, "GET", "/admin/store/redemptions/pending?phone="+database.SeedVerifiedCustomerPhone,
		demoManager(t), database.SeedDemoTenantUUID, nil)
	expectStatus(t, pending, http.StatusOK)
	found := false
	for _, item := range pending.Body["data"].([]any) {
		row := item.(map[string]any)
		if _, leaked := row["pickup_code"]; leaked {
			t.Fatal("staff listing must not return pickup codes")
		}
		if str(row["redemption_uuid"]) == id {
			found = true
		}
	}
	if !found {
		t.Fatalf("redemption %s missing from the pending list", id)
	}

	wrong := "000000"
	if code == wrong {
		wrong = "111111"
	}
	expectError(t, collect(t, id, wrong), http.StatusBadRequest, "INVALID_PICKUP_CODE")

	ok := collect(t, id, code)
	expectStatus(t, ok, http.StatusOK)
	if got := str(ok.Body["redemption"].(map[string]any)["status"]); got != "COLLECTED" {
		t.Fatalf("status = %s, want COLLECTED", got)
	}

	// Collected gold cannot be collected again or cancelled.
	expectError(t, collect(t, id, code), http.StatusConflict, "REDEMPTION_NOT_PENDING")
	cancel := call(t, "POST", "/trade/redemptions/"+id+"/cancel", verifiedCustomer(t), database.SeedDemoTenantUUID, nil)
	expectError(t, cancel, http.StatusConflict, "REDEMPTION_NOT_PENDING")
	expectGrams(t, "balance after collection", balance(t, database.SeedVerifiedCustomerUUID), before-1)
}

func TestRedemption_CustomerCancelReturnsGold(t *testing.T) {
	counterBuy(t, database.SeedVerifiedCustomerUUID, 1)
	before := balance(t, database.SeedVerifiedCustomerUUID)

	rr := requestRedemption(t, verifiedCustomer(t), 0.5)
	id := str(rr["redemption_uuid"])

	r := call(t, "POST", "/trade/redemptions/"+id+"/cancel", verifiedCustomer(t), database.SeedDemoTenantUUID, nil)
	expectStatus(t, r, http.StatusOK)
	expectGrams(t, "balance after cancel", balance(t, database.SeedVerifiedCustomerUUID), before)

	again := call(t, "POST", "/trade/redemptions/"+id+"/cancel", verifiedCustomer(t), database.SeedDemoTenantUUID, nil)
	expectError(t, again, http.StatusConflict, "REDEMPTION_NOT_PENDING")

	list := call(t, "GET", "/trade/redemptions", verifiedCustomer(t), database.SeedDemoTenantUUID, nil)
	expectStatus(t, list, http.StatusOK)
	for _, item := range list.Body["data"].([]any) {
		row := item.(map[string]any)
		if str(row["redemption_uuid"]) == id && str(row["status"]) != "CANCELLED" {
			t.Fatalf("status = %s, want CANCELLED", row["status"])
		}
	}
}

func TestRedemption_StaffCancelReturnsGold(t *testing.T) {
	counterBuy(t, database.SeedVerifiedCustomerUUID, 1)
	before := balance(t, database.SeedVerifiedCustomerUUID)
	rr := requestRedemption(t, verifiedCustomer(t), 0.25)

	r := call(t, "POST", "/admin/store/redemptions/cancel", demoManager(t), database.SeedDemoTenantUUID,
		map[string]string{"redemption_uuid": str(rr["redemption_uuid"])})
	expectStatus(t, r, http.StatusOK)
	expectGrams(t, "balance after staff cancel", balance(t, database.SeedVerifiedCustomerUUID), before)
}

func TestRedemption_CannotCancelAnotherCustomersRequest(t *testing.T) {
	counterBuy(t, database.SeedVerifiedCustomerUUID, 1)
	rr := requestRedemption(t, verifiedCustomer(t), 0.1)

	r := call(t, "POST", "/trade/redemptions/"+str(rr["redemption_uuid"])+"/cancel",
		pendingCustomer(t), database.SeedDemoTenantUUID, nil)
	expectError(t, r, http.StatusNotFound, "REDEMPTION_NOT_FOUND")
}

func TestRedemption_CannotOverdraw(t *testing.T) {
	grams := balance(t, database.SeedVerifiedCustomerUUID) + 1
	r := call(t, "POST", "/trade/redeem", verifiedCustomer(t), database.SeedDemoTenantUUID,
		map[string]any{"weight_grams": grams})
	expectError(t, r, http.StatusBadRequest, "ERROR_INSUFFICIENT_BALANCE")
}

func TestRedemption_RejectsZeroOrNegativeWeight(t *testing.T) {
	for _, grams := range []float64{0, -1, 0.00001} {
		t.Run(fmt.Sprint(grams), func(t *testing.T) {
			r := call(t, "POST", "/trade/redeem", verifiedCustomer(t), database.SeedDemoTenantUUID,
				map[string]any{"weight_grams": grams})
			expectError(t, r, http.StatusBadRequest, "INVALID_PAYLOAD")
		})
	}
}
