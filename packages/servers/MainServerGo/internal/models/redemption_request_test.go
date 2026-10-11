package models

import "testing"

func TestSetCodeAttemptsLeft(t *testing.T) {
	cases := []struct{ failed, want int }{
		{0, MaxPickupCodeAttempts},
		{3, MaxPickupCodeAttempts - 3},
		{MaxPickupCodeAttempts, 0},
		// Never negative, even if the count ran past the limit.
		{MaxPickupCodeAttempts + 2, 0},
	}
	for _, tc := range cases {
		rr := RedemptionRequest{FailedCodeAttempts: tc.failed}
		rr.SetCodeAttemptsLeft()
		if rr.CodeAttemptsLeft == nil || *rr.CodeAttemptsLeft != tc.want {
			t.Errorf("failed=%d: attempts left = %v, want %d", tc.failed, rr.CodeAttemptsLeft, tc.want)
		}
	}
}
