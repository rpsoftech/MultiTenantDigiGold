package service

import (
	"errors"
	"fmt"
	"testing"
)

// RefreshAdminTokens restores a consumed refresh record only on server faults, so a
// client error (deleted or deactivated admin) must never be classed as one.
func TestIsServerFault(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"no error", nil, false},
		{"client error", errAdminDeactivated, false},
		{"wrapped client error", fmt.Errorf("refresh: %w", errAdminRefreshTokenInvalid), false},
		{"redis or database failure", errors.New("connection refused"), true},
		{"wrapped infrastructure failure", fmt.Errorf("failed to record admin refresh token: %w", errors.New("timeout")), true},
	}
	for _, tc := range cases {
		if got := isServerFault(tc.err); got != tc.want {
			t.Errorf("%s: isServerFault = %v, want %v", tc.name, got, tc.want)
		}
	}
}
