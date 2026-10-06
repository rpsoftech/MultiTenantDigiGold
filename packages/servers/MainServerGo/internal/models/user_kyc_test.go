package models

import (
	"encoding/json"
	"testing"
)

func TestCustomerKYCStatus(t *testing.T) {
	submitted := json.RawMessage(`{"pan_number":"ABCDE1234F","aadhaar_last4":"1234"}`)

	cases := []struct {
		name      string
		status    string
		doc       json.RawMessage
		want      string
		canSubmit bool
	}{
		{"new user (column default)", "pending", json.RawMessage(`{}`), KYCStatusNotStarted, true},
		{"new user (json null)", "pending", json.RawMessage(`null`), KYCStatusNotStarted, true},
		{"new user (no column value)", "pending", nil, KYCStatusNotStarted, true},
		{"submitted, awaiting review", "pending", submitted, KYCStatusPending, false},
		{"verified", "verified", submitted, KYCStatusVerified, false},
		{"verified at the counter without documents", "verified", json.RawMessage(`{}`), KYCStatusVerified, false},
		{"rejected", "rejected", submitted, KYCStatusRejected, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			u := &User{KYCStatus: tc.status, DocumentJSON: tc.doc}
			if got := u.CustomerKYCStatus(); got != tc.want {
				t.Errorf("CustomerKYCStatus() = %q, want %q", got, tc.want)
			}
			if got := u.CanSubmitKYC(); got != tc.canSubmit {
				t.Errorf("CanSubmitKYC() = %v, want %v", got, tc.canSubmit)
			}
		})
	}
}
