package service

import (
	"errors"
	"math"
	"testing"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
)

func TestMathRecalculationBlock(t *testing.T) {
	testCases := []struct {
		name                 string
		requestedRatePerGram float64
		weightGrams          float64
		totalAmountINR       float64
		expectedWeight       float64
		expectedTotalINR     float64
	}{
		{
			name:                 "Buy By Weight",
			requestedRatePerGram: 5000.0,
			weightGrams:          1.5,
			totalAmountINR:       0,
			expectedWeight:       1.5000,
			expectedTotalINR:     7500.00,
		},
		{
			name:                 "Buy By Amount",
			requestedRatePerGram: 5000.0,
			weightGrams:          0,
			totalAmountINR:       5000.0,
			expectedWeight:       1.0000,
			expectedTotalINR:     5000.00,
		},
		{
			name:                 "Buy By Weight Floating Point Rounding",
			requestedRatePerGram: 5123.456,
			weightGrams:          1.23456,
			totalAmountINR:       0,
			expectedWeight:       1.2346,
			expectedTotalINR:     6325.42,
		},
		{
			name:                 "Buy By Amount Floating Point Rounding",
			requestedRatePerGram: 5123.456,
			weightGrams:          0,
			totalAmountINR:       5123.45,
			expectedWeight:       1.0000,
			expectedTotalINR:     5123.45,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			finalWeight, finalTotalINR, err := sizeTrade(tc.weightGrams, tc.totalAmountINR, tc.requestedRatePerGram)
			if err != nil {
				t.Fatalf("sizeTrade: %v", err)
			}

			if math.Abs(finalWeight-tc.expectedWeight) > 0.0001 {
				t.Errorf("expected weight %f, got %f", tc.expectedWeight, finalWeight)
			}
			if math.Abs(finalTotalINR-tc.expectedTotalINR) > 0.01 {
				t.Errorf("expected total INR %f, got %f", tc.expectedTotalINR, finalTotalINR)
			}
		})
	}
}

func TestSizeTradeRejectsEmptyOrTinyTrades(t *testing.T) {
	cases := []struct {
		name           string
		weight, amount float64
	}{
		{"nothing", 0, 0},
		{"negative", -1, -100},
		{"rounds to zero grams", 0, 0.01},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, _, err := sizeTrade(tc.weight, tc.amount, 7000); !errors.Is(err, interfaces.ErrInvalidTradePayload) {
				t.Fatalf("expected ErrInvalidTradePayload, got %v", err)
			}
		})
	}
}

func TestBuyPrice(t *testing.T) {
	cases := []struct {
		name   string
		margin models.MarginConfig
		want   float64
	}{
		{"fixed margin with GST", models.MarginConfig{SellMarginType: "FIXED_INR", SellMarginValue: 100, IsGSTEnabled: true, GSTPercentage: 3}, 7313},
		{"percentage margin, no GST", models.MarginConfig{SellMarginType: "PERCENTAGE", SellMarginValue: 2}, 7140},
		{"no margin, no GST", models.MarginConfig{SellMarginType: "FIXED_INR"}, 7000},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, _, _ := buyPrice(7000, &tc.margin)
			if math.Abs(got-tc.want) > 0.001 {
				t.Errorf("buyPrice = %f, want %f", got, tc.want)
			}
		})
	}
}

func TestNewPickupCode(t *testing.T) {
	for i := 0; i < 100; i++ {
		code, err := newPickupCode()
		if err != nil {
			t.Fatal(err)
		}
		if len(code) != 6 {
			t.Fatalf("pickup code %q must have 6 digits", code)
		}
	}
}

func TestTradeQuoteExpired(t *testing.T) {
	now := time.Unix(1_000_000, 0)
	q := &TradeQuote{ExpiresAt: now.Unix()}
	if q.Expired(now) {
		t.Error("quote must still be valid at its expiry second")
	}
	if !q.Expired(now.Add(time.Second)) {
		t.Error("quote must be expired after its expiry second")
	}
}

func TestIsPermanentTradeError(t *testing.T) {
	if !isPermanentTradeError(errors.Join(interfaces.ErrCreditLimitExceeded, errors.New("detail"))) {
		t.Error("credit limit errors must be permanent")
	}
	if isPermanentTradeError(errors.New("connection refused")) {
		t.Error("database errors must be retried, not refunded")
	}
}
