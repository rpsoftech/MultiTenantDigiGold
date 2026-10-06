//go:build integration

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
)

// fakeRazorpay stands in for api.razorpay.com. It creates orders and refunds and
// records every call so tests can assert on them.
type fakeRazorpay struct {
	*httptest.Server

	mu      sync.Mutex
	orders  map[string]fakeOrder
	refunds []fakeRefund
	nextID  int
}

type fakeOrder struct {
	ID          string
	AmountPaise int64
	Notes       map[string]any
}

type fakeRefund struct {
	ID          string
	PaymentID   string
	AmountPaise int64
}

func newFakeRazorpay() *fakeRazorpay {
	f := &fakeRazorpay{orders: map[string]fakeOrder{}}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/orders", f.createOrder)
	mux.HandleFunc("POST /v1/payments/{id}/refund", f.refund)
	f.Server = httptest.NewServer(mux)
	return f
}

func (f *fakeRazorpay) createOrder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Amount int64          `json:"amount"`
		Notes  map[string]any `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	f.mu.Lock()
	f.nextID++
	order := fakeOrder{ID: fmt.Sprintf("order_test_%d", f.nextID), AmountPaise: body.Amount, Notes: body.Notes}
	f.orders[order.ID] = order
	f.mu.Unlock()

	writeJSON(w, map[string]any{"id": order.ID, "amount": order.AmountPaise, "status": "created"})
}

func (f *fakeRazorpay) refund(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Amount int64 `json:"amount"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	f.mu.Lock()
	f.nextID++
	refund := fakeRefund{ID: fmt.Sprintf("rfnd_test_%d", f.nextID), PaymentID: r.PathValue("id"), AmountPaise: body.Amount}
	f.refunds = append(f.refunds, refund)
	f.mu.Unlock()

	writeJSON(w, map[string]any{"id": refund.ID, "payment_id": refund.PaymentID, "amount": refund.AmountPaise})
}

func (f *fakeRazorpay) order(id string) (fakeOrder, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	o, ok := f.orders[id]
	return o, ok
}

func (f *fakeRazorpay) orderCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.orders)
}

// refundFor returns the refund issued for a payment, if any.
func (f *fakeRazorpay) refundFor(paymentID string) (fakeRefund, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, r := range f.refunds {
		if r.PaymentID == paymentID {
			return r, true
		}
	}
	return fakeRefund{}, false
}

// newPaymentID returns a unique fake Razorpay payment ID.
func (f *fakeRazorpay) newPaymentID() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.nextID++
	return fmt.Sprintf("pay_test_%d", f.nextID)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
