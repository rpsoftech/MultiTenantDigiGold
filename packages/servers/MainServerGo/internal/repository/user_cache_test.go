package repository

import (
	"encoding/json"
	"testing"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
)

// The user cache must keep the internal IDs that models.User hides from API JSON.
func TestUserCacheKeepsInternalIDs(t *testing.T) {
	in := &models.User{ID: 42, TenantID: 7, UUID: "u-1", PhoneNumber: "9999900001", VaultBalance: 1.2345}
	raw, err := json.Marshal(userCacheEntry{User: in, CachedID: in.ID, CachedTenantID: in.TenantID})
	if err != nil {
		t.Fatal(err)
	}

	out, ok := decodeUserCache(string(raw))
	if !ok {
		t.Fatal("cache entry not decoded")
	}
	if out.ID != 42 || out.TenantID != 7 || out.UUID != "u-1" || out.VaultBalance != 1.2345 {
		t.Fatalf("decoded user = %+v", out)
	}
}

// Entries written by older versions (no internal IDs) must count as a cache miss.
func TestUserCacheIgnoresEntriesWithoutIDs(t *testing.T) {
	legacy, _ := json.Marshal(&models.User{ID: 42, UUID: "u-1"}) // json:"-" drops ID
	if _, ok := decodeUserCache(string(legacy)); ok {
		t.Fatal("legacy entry without IDs must be a miss")
	}
}
