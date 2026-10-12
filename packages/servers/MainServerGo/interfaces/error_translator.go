package interfaces

import (
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
)

// ParseDBError translates your clean domain errors into your strict JSON format
func ParseDBError(err error) *RequestError {
	if err == nil {
		return nil
	}
	if reqErr, ok := err.(*RequestError); ok {
		return reqErr
	}
	var mismatch *PickupCodeMismatchError
	if errors.As(err, &mismatch) {
		tries := "tries"
		if mismatch.AttemptsLeft == 1 {
			tries = "try"
		}
		return &RequestError{
			StatusCode: 400,
			Code:       ERROR_INVALID_INPUT,
			Message:    fmt.Sprintf("Pickup code does not match. %d %s left before this pickup is locked.", mismatch.AttemptsLeft, tries),
			Name:       "INVALID_PICKUP_CODE",
			Extra:      map[string]int{"attempts_left": mismatch.AttemptsLeft},
		}
	}
	// 1. Check for specific fixed structures using errors.Is()
	switch {
	case errors.Is(err, ErrUserNotFound):
		return &RequestError{
			StatusCode:    404,
			Code:          ERROR_USER_NOT_FOUND,
			Message:       "The requested user could not be found.",
			Name:          "ERROR_USER_NOT_FOUND",
			LogTheDetails: false, // Don't wake up developers for a 404
		}

	case errors.Is(err, ErrTenantNotFound):
		return &RequestError{
			StatusCode:    401, // 401 Unauthorized because the tenant ID is invalid
			Code:          ERROR_ENTITY_NOT_FOUND,
			Message:       "Invalid Tenant ID.",
			Name:          "ERROR_INVALID_TENANT",
			LogTheDetails: true, // Log this, someone might be trying to bypass isolation
		}

	case errors.Is(err, ErrTenantInactive):
		return &RequestError{
			StatusCode: 403,
			Code:       ERROR_PERMISSION_NOT_ALLOWED,
			Message:    "This store is currently unavailable.",
			Name:       "TENANT_INACTIVE",
		}

	case errors.Is(err, ErrAdminNotFound):
		return &RequestError{
			StatusCode:    401,
			Code:          ERROR_ENTITY_NOT_FOUND,
			Message:       "Admin/Staff Member Not Found or Inactive.",
			Name:          "ErrAdminNotFound",
			LogTheDetails: false,
		}

	case errors.Is(err, ErrInvalidToken):
		return &RequestError{
			StatusCode:    401,
			Code:          ERROR_INVALID_TOKEN,
			Message:       "User Token Not Found or Invalid.",
			Name:          "ERROR_INVALID_TOKEN",
			LogTheDetails: false,
		}
	case errors.Is(err, ErrRecentOTPReqExist):
		return &RequestError{
			StatusCode:    429, // 429 Too Many Requests (Industry standard for rate limiting)
			Code:          ERROR_RECENT_OTP_REQ_EXIST,
			Message:       "Please wait 30 seconds before requesting a new OTP.",
			Name:          "ERROR_RECENT_OTP_REQ_EXIST",
			LogTheDetails: false, // Normal user behavior, do not spam your server logs
		}

	case errors.Is(err, ErrOTPReqNotFound):
		return &RequestError{
			StatusCode:    404, // 404 Not Found
			Code:          ERROR_OTP_REQ_NOT_FOUND,
			Message:       "Your OTP has expired or was not found. Please request a new one.",
			Name:          "ERROR_OTP_REQ_NOT_FOUND",
			LogTheDetails: false,
		}

	case errors.Is(err, ErrOTPInvalid):
		return &RequestError{
			StatusCode:    401, // 401 Unauthorized
			Code:          ERROR_OTP_INVALID,
			Message:       "The OTP you entered is incorrect.",
			Name:          "ERROR_OTP_INVALID",
			LogTheDetails: false, // Users make typos all the time, keep logs clean
		}

	case errors.Is(err, ErrMaxResendAttempts):
		return &RequestError{
			StatusCode:    429,
			Code:          ERROR_TOO_MANY_ATTEMPTS,
			Message:       "Maximum OTP resend attempts reached. Please try again later.",
			Name:          "ERROR_MAX_RESEND_ATTEMPTS",
			LogTheDetails: false,
		}

	case errors.Is(err, ErrInsufficientBalance):
		return &RequestError{
			StatusCode: 400,
			Code:       ERROR_INSUFFICIENT_BALANCE,
			Message:    "Insufficient gold balance for this transaction.",
			Name:       "ERROR_INSUFFICIENT_BALANCE",
		}

	case errors.Is(err, ErrSlippageExceeded):
		return &RequestError{
			StatusCode: 409,
			Code:       ERROR_INVALID_INPUT,
			Message:    "Live rate moved beyond allowable tolerance. Please refresh the rate and retry.",
			Name:       "SLIPPAGE_EXCEEDED",
		}

	case errors.Is(err, ErrInvalidTradePayload):
		return &RequestError{
			StatusCode: 400,
			Code:       ERROR_INVALID_INPUT,
			Message:    ErrInvalidTradePayload.Error(),
			Name:       "INVALID_PAYLOAD",
		}

	case errors.Is(err, ErrCashLimitExceeded):
		return &RequestError{
			StatusCode: 400,
			Code:       ERROR_INVALID_INPUT,
			Message:    "Cash received from this customer today would reach ₹2,00,000, which the law does not allow. Take the rest by UPI.",
			Name:       "CASH_LIMIT_EXCEEDED",
		}

	case errors.Is(err, ErrCounterQuoteExpired):
		return &RequestError{
			StatusCode: 409,
			Code:       ERROR_INVALID_INPUT,
			Message:    "This price has expired. Get a new price before confirming the sale.",
			Name:       "COUNTER_QUOTE_EXPIRED",
		}

	case errors.Is(err, ErrPickupCodeLocked):
		return &RequestError{
			StatusCode: 423,
			Code:       ERROR_TOO_MANY_ATTEMPTS,
			Message:    "Too many wrong pickup codes were entered, so this pickup is locked. Cancel it to return the gold to the customer's vault; they can then request a new pickup.",
			Name:       "PICKUP_CODE_LOCKED",
		}

	case errors.Is(err, ErrTenantKYCDocNotFound):
		return &RequestError{
			StatusCode: 404,
			Code:       ERROR_ENTITY_NOT_FOUND,
			Message:    "KYC document not found for this tenant.",
			Name:       "TENANT_KYC_DOC_NOT_FOUND",
		}

	case errors.Is(err, ErrKYCNotAwaitingReview):
		return &RequestError{
			StatusCode: 409,
			Code:       ERROR_INVALID_INPUT,
			Message:    "This customer has no KYC submission waiting for review. Another admin may already have decided it.",
			Name:       "KYC_NOT_AWAITING_REVIEW",
		}

	case errors.Is(err, ErrCounterSaleInProgress):
		return &RequestError{
			StatusCode: 409,
			Code:       ERROR_INVALID_INPUT,
			Message:    "This sale is still being recorded. Wait a moment, then try again to see the result.",
			Name:       "COUNTER_SALE_IN_PROGRESS",
		}

	case errors.Is(err, ErrLedgerEntryNotFound):
		return &RequestError{
			StatusCode: 404,
			Code:       ERROR_ENTITY_NOT_FOUND,
			Message:    "Transaction not found.",
			Name:       "ERROR_LEDGER_NOT_FOUND",
		}

	case errors.Is(err, ErrLedgerAlreadyReversed), errors.Is(err, ErrLedgerNotReversible):
		return &RequestError{
			StatusCode: 409,
			Code:       ERROR_LEDGER_REVERSAL,
			Message:    err.Error(),
			Name:       "ERROR_LEDGER_REVERSAL",
		}

	case errors.Is(err, ErrCreditLimitExceeded):
		return &RequestError{
			StatusCode: 409,
			Code:       ERROR_INVALID_INPUT,
			Message:    "This store cannot accept the trade right now. Please try a smaller amount or contact the store.",
			Name:       "CREDIT_LIMIT_EXCEEDED",
		}

	case errors.Is(err, ErrRedemptionNotPending):
		return &RequestError{
			StatusCode: 409,
			Code:       ERROR_LEDGER_REVERSAL,
			Message:    "Redemption is no longer pending.",
			Name:       "REDEMPTION_NOT_PENDING",
		}

	case errors.Is(err, ErrRedemptionBelowMinimum):
		return &RequestError{
			StatusCode: 400,
			Code:       ERROR_INVALID_INPUT,
			Message:    "The minimum redemption is 1 g.",
			Name:       "REDEMPTION_BELOW_MINIMUM",
		}

	case errors.Is(err, ErrRedemptionNotFound):
		return &RequestError{
			StatusCode: 404,
			Code:       ERROR_ENTITY_NOT_FOUND,
			Message:    "Redemption request not found.",
			Name:       "REDEMPTION_NOT_FOUND",
		}

	case errors.Is(err, ErrInvalidPickupCode):
		return &RequestError{
			StatusCode: 400,
			Code:       ERROR_INVALID_INPUT,
			Message:    "Pickup code does not match.",
			Name:       "INVALID_PICKUP_CODE",
		}

	case errors.Is(err, ErrMaxVerifyAttempts):
		return &RequestError{
			StatusCode:    429,
			Code:          ERROR_TOO_MANY_ATTEMPTS,
			Message:       "Too many incorrect guesses. OTP has been invalidated.",
			Name:          "ERROR_MAX_VERIFY_ATTEMPTS",
			LogTheDetails: false,
		}
	}

	// 2. PostgreSQL rejected the request's data. These are the client's mistakes (a value
	// that already exists, a malformed UUID in the path, a value too long or not allowed), not
	// server failures, so they must not answer 500 or alert. The details name tables and
	// constraints, so they are not sent.
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			return &RequestError{
				StatusCode: 409,
				Code:       ERROR_DUPLICATE_USER,
				Message:    "That record already exists.",
				Name:       "ALREADY_EXISTS",
			}
		case "22P02", "22001", "23514": // invalid_text_representation, string_data_right_truncation, check_violation
			return &RequestError{
				StatusCode: 400,
				Code:       ERROR_INVALID_INPUT,
				Message:    "One of the values sent is not valid.",
				Name:       "INVALID_INPUT",
			}
		}
	}

	// 3. Fallback for actual database crashes (Connection dropped, syntax error, etc.)
	return &RequestError{
		StatusCode:    500,
		Code:          ERROR_INTERNAL_SERVER,
		Message:       "An unexpected system error occurred.",
		Name:          "ERROR_INTERNAL_SERVER",
		Extra:         err.Error(), // Safe to log internally, maybe hide from frontend
		LogTheDetails: true,
	}
}
