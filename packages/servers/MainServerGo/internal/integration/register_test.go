//go:build integration

package integration

import (
	"database/sql"
	"net/http"
	"testing"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

// The OTP step (WhatsApp) can't run here, so the registration token it would hand out is
// minted directly; everything from /auth/register on is the real flow.
func registrationToken(t *testing.T, phone string) string {
	t.Helper()
	token, err := service.GetJWTService().GenerateRegistrationToken(phone, database.SeedDemoTenantUUID)
	if err != nil {
		t.Fatalf("mint registration token: %v", err)
	}
	return token
}

func register(t *testing.T, phone, fullName, city string) response {
	t.Helper()
	return call(t, "POST", "/auth/register", "", database.SeedDemoTenantUUID, map[string]string{
		"registration_token": registrationToken(t, phone),
		"full_name":          fullName,
		"location":           city,
		"email_id":           "",
	})
}

func TestRegister_StoresTheCityTheCustomerEntered(t *testing.T) {
	const phone = "9000000071"
	res := register(t, phone, "  Asha Rao ", "  Pune ")
	expectStatus(t, res, http.StatusOK)
	if str(res.Body["access_token"]) == "" {
		t.Fatal("registration must sign the customer in")
	}

	var name string
	var city sql.NullString
	err := db.QueryRow(`
		SELECT u.user_full_name, u.user_city FROM users u
		JOIN tenants t ON t.tenant_id = u.user_tenant_id
		WHERE t.tenant_uuid = $1 AND u.user_phone_number = $2`,
		database.SeedDemoTenantUUID, phone).Scan(&name, &city)
	if err != nil {
		t.Fatalf("registered customer not found: %v", err)
	}
	if name != "Asha Rao" || city.String != "Pune" {
		t.Fatalf("stored name/city = %q/%q, want trimmed %q/%q", name, city.String, "Asha Rao", "Pune")
	}

	// Staff see it in the customer list.
	list := call(t, "GET", "/admin/store/customers?limit=100", demoManager(t), database.SeedDemoTenantUUID, nil)
	expectStatus(t, list, http.StatusOK)
	rows, _ := list.Body["data"].([]any)
	for _, row := range rows {
		customer, _ := row.(map[string]any)
		if str(customer["phone_number"]) == phone {
			if got := str(customer["city"]); got != "Pune" {
				t.Fatalf("customer list city = %q, want Pune", got)
			}
			return
		}
	}
	t.Fatal("registered customer missing from the admin customer list")
}

func TestRegister_RequiresANameAndACity(t *testing.T) {
	cases := []struct {
		name, fullName, city string
	}{
		{"blank city", "Ravi Kumar", "   "},
		{"one-letter city", "Ravi Kumar", "P"},
		{"blank name", "  ", "Pune"},
	}
	for i, tc := range cases {
		phone := "900000008" + string(rune('0'+i))
		res := register(t, phone, tc.fullName, tc.city)
		expectError(t, res, http.StatusBadRequest, "INVALID_INPUT")

		var count int
		if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE user_phone_number = $1`, phone).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("%s: a customer was created despite invalid input", tc.name)
		}
	}
}
