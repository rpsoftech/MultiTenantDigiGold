//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"testing"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
)

// initiateBuy starts an online buy for the verified customer and returns the order.
func initiateBuy(t *testing.T, amountINR float64) (orderID string, weight float64) {
	t.Helper()
	r := call(t, "POST", "/trade/buy/initiate", verifiedCustomer(t), database.SeedDemoTenantUUID, map[string]any{
		"total_amount_inr":        amountINR,
		"requested_rate_per_gram": demoBuyRate,
	})
	expectStatus(t, r, http.StatusOK)
	orderID = str(r.Body["order_id"])
	if orderID == "" {
		t.Fatalf("no order_id in %v", r.Body)
	}
	return orderID, num(r.Body["weight_grams"])
}

// The main flow: initiate, Razorpay captures the payment, the webhook credits gold.
func TestOnlineBuy_WebhookCreditsGoldAtLockedQuote(t *testing.T) {
	setLiveRate(t, 7000, 6950)
	before := balance(t, database.SeedVerifiedCustomerUUID)

	orderID, weight := initiateBuy(t, 1000)
	wantWeight := math.Round(1000/demoBuyRate*10000) / 10000
	expectGrams(t, "quoted weight", weight, wantWeight)

	order, _ := razorpay.order(orderID)
	if order.AmountPaise != 100000 {
		t.Fatalf("Razorpay order amount = %d paise, want 100000", order.AmountPaise)
	}

	// The rate moves a lot before the payment is captured. The quote is locked,
	// so the customer still gets the quoted grams.
	setLiveRate(t, 7500, 7450)
	t.Cleanup(func() { setLiveRate(t, 7000, 6950) })

	paymentID := razorpay.newPaymentID()
	expectStatus(t, webhook(t, orderID, paymentID, 100000, webhookSecret), http.StatusOK)
	expectGrams(t, "balance after capture", balance(t, database.SeedVerifiedCustomerUUID), before+wantWeight)

	var mode, eventType string
	if err := db.QueryRow(`SELECT gl_payment_mode, gl_event_type FROM gold_transaction_ledger WHERE gl_reference_id = $1`,
		paymentID).Scan(&mode, &eventType); err != nil {
		t.Fatalf("ledger row for payment: %v", err)
	}
	if mode != "ONLINE_PG" || eventType != "GOLD_PURCHASE" {
		t.Fatalf("ledger = %s/%s, want ONLINE_PG/GOLD_PURCHASE", mode, eventType)
	}

	// Razorpay retries the same webhook: no second credit.
	expectStatus(t, webhook(t, orderID, paymentID, 100000, webhookSecret), http.StatusOK)
	expectGrams(t, "balance after duplicate webhook", balance(t, database.SeedVerifiedCustomerUUID), before+wantWeight)
}

func TestOnlineBuy_BadSignatureIsRejected(t *testing.T) {
	before := balance(t, database.SeedVerifiedCustomerUUID)
	orderID, _ := initiateBuy(t, 500)

	r := webhook(t, orderID, razorpay.newPaymentID(), 50000, "wrong-secret")
	expectStatus(t, r, http.StatusBadRequest)
	expectGrams(t, "balance", balance(t, database.SeedVerifiedCustomerUUID), before)
}

func TestOnlineBuy_AmountMismatchIsRefunded(t *testing.T) {
	before := balance(t, database.SeedVerifiedCustomerUUID)
	orderID, _ := initiateBuy(t, 500)
	paymentID := razorpay.newPaymentID()

	expectStatus(t, webhook(t, orderID, paymentID, 100, webhookSecret), http.StatusOK)

	expectGrams(t, "balance", balance(t, database.SeedVerifiedCustomerUUID), before)
	refund, ok := razorpay.refundFor(paymentID)
	if !ok || refund.AmountPaise != 100 {
		t.Fatalf("want a full refund of 100 paise, got %+v (found=%t)", refund, ok)
	}
	if !eventExists(t, events.TradeEventPaymentRefunded, "payment_id", paymentID) {
		t.Fatal("no TRADE_PAYMENT_REFUNDED event")
	}
}

func TestOnlineBuy_PaymentAfterQuoteExpiryIsRefunded(t *testing.T) {
	before := balance(t, database.SeedVerifiedCustomerUUID)
	orderID, _ := initiateBuy(t, 500)

	// Age the stored quote instead of waiting 15 minutes.
	ctx := context.Background()
	key := "digiGold:trade_intent:" + orderID
	raw, err := rdb.Get(ctx, key).Result()
	if err != nil {
		t.Fatalf("read intent: %v", err)
	}
	var intent map[string]map[string]any
	_ = json.Unmarshal([]byte(raw), &intent)
	intent["quote"]["expires_at"] = time.Now().Add(-time.Minute).Unix()
	aged, _ := json.Marshal(intent)
	if err := rdb.Set(ctx, key, aged, time.Hour).Err(); err != nil {
		t.Fatalf("write intent: %v", err)
	}

	paymentID := razorpay.newPaymentID()
	expectStatus(t, webhook(t, orderID, paymentID, 50000, webhookSecret), http.StatusOK)

	expectGrams(t, "balance", balance(t, database.SeedVerifiedCustomerUUID), before)
	if _, ok := razorpay.refundFor(paymentID); !ok {
		t.Fatal("expired quote must be refunded")
	}
}

func TestOnlineBuy_SlippageIsRejected(t *testing.T) {
	r := call(t, "POST", "/trade/buy/initiate", verifiedCustomer(t), database.SeedDemoTenantUUID, map[string]any{
		"total_amount_inr":        1000,
		"requested_rate_per_gram": demoBuyRate - 100, // client shows a stale price
	})
	expectError(t, r, http.StatusConflict, "SLIPPAGE_EXCEEDED")
}

func TestOnlineBuy_NoOrderWhenStoreIsOutOfCredit(t *testing.T) {
	// Leave the store no room: credit limit = what is already unlifted.
	const demoMargin = `FROM tenants t WHERE t.tenant_id = mc.mc_tenant_id AND t.tenant_uuid = $1`
	var limit float64
	if err := db.QueryRow(`SELECT mc_tenant_credit_limit_grams FROM margin_configurations mc `+demoMargin,
		database.SeedDemoTenantUUID).Scan(&limit); err != nil {
		t.Fatalf("read credit limit: %v", err)
	}
	if _, err := db.Exec(`UPDATE margin_configurations mc SET mc_tenant_credit_limit_grams = mc_tenant_unlifted_grams `+demoMargin,
		database.SeedDemoTenantUUID); err != nil {
		t.Fatalf("lower credit limit: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`UPDATE margin_configurations mc SET mc_tenant_credit_limit_grams = $2 `+demoMargin,
			database.SeedDemoTenantUUID, limit)
	})

	ordersBefore := razorpay.orderCount()
	r := call(t, "POST", "/trade/buy/initiate", verifiedCustomer(t), database.SeedDemoTenantUUID, map[string]any{
		"total_amount_inr":        1000,
		"requested_rate_per_gram": demoBuyRate,
	})
	expectError(t, r, http.StatusConflict, "CREDIT_LIMIT_EXCEEDED")
	if razorpay.orderCount() != ordersBefore {
		t.Fatal("no Razorpay order may be created when the store cannot settle the buy")
	}
}

func TestOnlineBuy_KYCRequiredAbove50000(t *testing.T) {
	r := call(t, "POST", "/trade/buy/initiate", pendingCustomer(t), database.SeedDemoTenantUUID, map[string]any{
		"total_amount_inr":        60000,
		"requested_rate_per_gram": demoBuyRate,
	})
	expectStatus(t, r, http.StatusForbidden)
}

func TestCounterBuy_CreditsGold(t *testing.T) {
	before := balance(t, database.SeedVerifiedCustomerUUID)
	trade := counterBuy(t, database.SeedVerifiedCustomerUUID, 2)

	if str(trade["payment_mode"]) != "COUNTER_CASH" || str(trade["event_type"]) != "GOLD_PURCHASE" {
		t.Fatalf("trade = %v", trade)
	}
	expectGrams(t, "balance", balance(t, database.SeedVerifiedCustomerUUID), before+2)
}

func TestCounterBuy_RejectsOnlinePaymentMode(t *testing.T) {
	r := call(t, "POST", "/admin/store/trade/counter", demoManager(t), database.SeedDemoTenantUUID, map[string]any{
		"user_uuid":               database.SeedVerifiedCustomerUUID,
		"requested_rate_per_gram": demoBuyRate,
		"weight_grams":            1,
		"payment_mode":            "ONLINE_PG",
	})
	expectStatus(t, r, http.StatusBadRequest)
}

func TestCustomerCannotSell(t *testing.T) {
	r := call(t, "POST", "/trade/sell", verifiedCustomer(t), database.SeedDemoTenantUUID, map[string]any{
		"weight_grams": 1, "requested_rate_per_gram": 6950,
	})
	if r.Status != http.StatusNotFound && r.Status != http.StatusMethodNotAllowed {
		t.Fatalf("POST /trade/sell status = %d, want 404 (the route must not exist)", r.Status)
	}
}
