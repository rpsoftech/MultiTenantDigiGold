package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
)

func newTestJWTService() *JWTService {
	return &JWTService{
		accessKey:  []byte(strings.Repeat("a", 32)),
		refreshKey: []byte(strings.Repeat("r", 32)),
	}
}

func TestTokensRoundTrip(t *testing.T) {
	s := newTestJWTService()

	access, refresh, err := s.GenerateTokens("user-1", "tenant-1", "9999999999")
	if err != nil {
		t.Fatal(err)
	}
	if c, err := s.ValidateAccessToken(access); err != nil || c.UserUUID != "user-1" {
		t.Fatalf("access token rejected: %v", err)
	}
	if c, err := s.ValidateRefreshToken(refresh); err != nil || c.UserUUID != "user-1" {
		t.Fatalf("refresh token rejected: %v", err)
	}

	adminAccess, adminRefresh, err := s.GenerateAdminTokens("admin-1", "manager", 7)
	if err != nil {
		t.Fatal(err)
	}
	if c, err := s.ValidateAdminToken(adminAccess); err != nil || c.TenantID != 7 {
		t.Fatalf("admin access token rejected: %v", err)
	}
	if c, err := s.ValidateAdminRefreshToken(adminRefresh); err != nil || c.AdminUUID != "admin-1" {
		t.Fatalf("admin refresh token rejected: %v", err)
	}

	reg, err := s.GenerateRegistrationToken("9999999999", "tenant-1")
	if err != nil {
		t.Fatal(err)
	}
	if phone, _, err := s.ValidateRegistrationToken(reg); err != nil || phone != "9999999999" {
		t.Fatalf("registration token rejected: %v", err)
	}
}

// A token of one kind must never validate as another kind, even when both are
// signed with the same key.
func TestTokenKindsAreNotInterchangeable(t *testing.T) {
	s := newTestJWTService()

	userAccess, userRefresh, _ := s.GenerateTokens("user-1", "tenant-1", "9999999999")
	adminAccess, adminRefresh, _ := s.GenerateAdminTokens("admin-1", "super_admin", 1)
	reg, _ := s.GenerateRegistrationToken("9999999999", "tenant-1")

	reject := func(name string, err error) {
		t.Helper()
		if !errors.Is(err, interfaces.ErrInvalidToken) {
			t.Errorf("%s: expected ErrInvalidToken, got %v", name, err)
		}
	}

	_, err := s.ValidateAdminToken(userAccess)
	reject("user access as admin access", err)
	_, err = s.ValidateAdminToken(reg)
	reject("registration as admin access", err)
	_, err = s.ValidateAccessToken(adminAccess)
	reject("admin access as user access", err)
	_, err = s.ValidateAccessToken(reg)
	reject("registration as user access", err)
	_, _, err = s.ValidateRegistrationToken(userAccess)
	reject("user access as registration", err)
	_, err = s.ValidateAdminRefreshToken(userRefresh)
	reject("user refresh as admin refresh", err)
	_, err = s.ValidateRefreshToken(adminRefresh)
	reject("admin refresh as user refresh", err)
}
