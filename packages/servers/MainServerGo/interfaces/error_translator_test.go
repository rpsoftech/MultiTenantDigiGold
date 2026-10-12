package interfaces

import (
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestParseDBError_PickupCodeMismatchSaysHowManyTriesAreLeft(t *testing.T) {
	err := &PickupCodeMismatchError{AttemptsLeft: 3}
	if !errors.Is(err, ErrInvalidPickupCode) {
		t.Fatal("a mismatch must still be ErrInvalidPickupCode")
	}

	got := ParseDBError(err)
	if got.StatusCode != 400 || got.Name != "INVALID_PICKUP_CODE" {
		t.Fatalf("status/name = %d/%s, want 400/INVALID_PICKUP_CODE", got.StatusCode, got.Name)
	}
	if extra, _ := got.Extra.(map[string]int); extra["attempts_left"] != 3 {
		t.Fatalf("extra = %v, want attempts_left 3", got.Extra)
	}
	if want := "Pickup code does not match. 3 tries left before this pickup is locked."; got.Message != want {
		t.Fatalf("message = %q, want %q", got.Message, want)
	}

	if one := ParseDBError(&PickupCodeMismatchError{AttemptsLeft: 1}); one.Message != "Pickup code does not match. 1 try left before this pickup is locked." {
		t.Fatalf("singular message = %q", one.Message)
	}
}

func TestParseDBError_LockedPickupIsNotAConflict(t *testing.T) {
	// 409 means "already collected or cancelled" to the counter screen; a lock must differ.
	got := ParseDBError(ErrPickupCodeLocked)
	if got.StatusCode != 423 || got.Name != "PICKUP_CODE_LOCKED" {
		t.Fatalf("status/name = %d/%s, want 423/PICKUP_CODE_LOCKED", got.StatusCode, got.Name)
	}
}

// PostgreSQL rejecting the request's data is the client's mistake: it must not answer 500
// (which also pages monitoring), even when the error is wrapped.
func TestParseDBError_PostgresDataErrorsAreClientErrors(t *testing.T) {
	cases := map[string]struct {
		status int
		name   string
	}{
		"23505": {409, "ALREADY_EXISTS"}, // unique_violation (e.g. a double-submitted registration)
		"22P02": {400, "INVALID_INPUT"},  // malformed UUID or enum value
		"22001": {400, "INVALID_INPUT"},  // value too long
		"23514": {400, "INVALID_INPUT"},  // check constraint
		"08006": {500, "ERROR_INTERNAL_SERVER"},
	}
	for code, want := range cases {
		err := fmt.Errorf("failed to save: %w", &pgconn.PgError{Code: code, Message: "details"})
		got := ParseDBError(err)
		if got.StatusCode != want.status || got.Name != want.name {
			t.Errorf("SQLSTATE %s: status/name = %d/%s, want %d/%s", code, got.StatusCode, got.Name, want.status, want.name)
		}
		if want.status < 500 && got.Extra != nil {
			t.Errorf("SQLSTATE %s: database details must not be sent: %v", code, got.Extra)
		}
	}
}
