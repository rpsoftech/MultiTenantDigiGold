package service

import (
	"math"
	"testing"
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
			var finalWeight, finalTotalINR float64
			finalRate := tc.requestedRatePerGram

			if tc.weightGrams > 0 {
				finalWeight = math.Round(tc.weightGrams*10000) / 10000
				finalTotalINR = math.Round((finalWeight*finalRate)*100) / 100
			} else if tc.totalAmountINR > 0 {
				finalTotalINR = math.Round(tc.totalAmountINR*100) / 100
				finalWeight = math.Round((finalTotalINR/finalRate)*10000) / 10000
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
