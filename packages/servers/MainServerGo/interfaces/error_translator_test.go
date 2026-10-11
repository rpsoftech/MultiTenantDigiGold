package interfaces

import (
	"errors"
	"testing"
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
