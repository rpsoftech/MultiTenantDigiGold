package database

import (
	"strings"
	"testing"
)

func TestBootstrapOptionsValidate(t *testing.T) {
	valid := BootstrapOptions{AdminUsername: "root", AdminPhone: "9000000001", AdminPassword: strings.Repeat("p", 12)}
	if err := valid.validate(); err != nil {
		t.Fatalf("valid options rejected: %v", err)
	}
	missing := BootstrapOptions{AdminPassword: strings.Repeat("p", 12)}
	if err := missing.validate(); err == nil || !strings.Contains(err.Error(), "BOOTSTRAP_ADMIN_USERNAME") ||
		!strings.Contains(err.Error(), "BOOTSTRAP_ADMIN_PHONE") {
		t.Fatalf("missing username/phone: got %v", err)
	}
	short := valid
	short.AdminPassword = "short"
	if err := short.validate(); err == nil {
		t.Fatal("a short super_admin password was accepted")
	}
}
