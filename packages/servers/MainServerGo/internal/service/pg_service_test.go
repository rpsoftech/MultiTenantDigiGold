package service

import (
	"errors"
	"fmt"
	"testing"

	rzperrors "github.com/razorpay/razorpay-go/errors"
)

// Razorpay refusing a refund of a payment it already fully refunded means the money is back
// with the customer: the webhook settles instead of failing and alerting on every retry.
// Any other refund error is still a failure.
func TestIsAlreadyRefundedError(t *testing.T) {
	cases := map[error]bool{
		&rzperrors.BadRequestError{Message: "The payment has been fully refunded already"}:       true,
		fmt.Errorf("wrapped: %w", &rzperrors.BadRequestError{Message: "Payment Fully Refunded"}): true,
		&rzperrors.BadRequestError{Message: "The refund amount provided is greater than amount"}: false,
		&rzperrors.ServerError{Message: "fully refunded"}:                                        false,
		errors.New("connection reset"):                                                           false,
	}
	for err, want := range cases {
		if got := isAlreadyRefundedError(err); got != want {
			t.Errorf("isAlreadyRefundedError(%v) = %v, want %v", err, got, want)
		}
	}
}
