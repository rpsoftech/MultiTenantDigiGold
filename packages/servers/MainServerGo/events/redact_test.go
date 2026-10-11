package events

import (
	"encoding/json"
	"reflect"
	"testing"
)

func decode(t *testing.T, raw string) any {
	t.Helper()
	var payload any
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("decode %s: %v", raw, err)
	}
	return payload
}

func TestRedactPayload_HidesSecretsAtAnyDepth(t *testing.T) {
	// The shapes OTP request and tenant config events are stored with.
	got := RedactPayload(decode(t, `{
		"otpCode": "482915", "phone": "9876543210", "reqId": "r-1",
		"payment_config": {"provider_type": "CUSTOM", "key_id": "rzp_live_x", "key_secret": "s3cret", "webhook_secret": "wh"},
		"whatsapp": [{"access_token": "tok", "template": "login_otp_template"}]
	}`))
	want := decode(t, `{
		"otpCode": "[redacted]", "phone": "9876543210", "reqId": "r-1",
		"payment_config": {"provider_type": "CUSTOM", "key_id": "rzp_live_x", "key_secret": "[redacted]", "webhook_secret": "[redacted]"},
		"whatsapp": [{"access_token": "[redacted]", "template": "login_otp_template"}]
	}`)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("redacted = %v\nwant      %v", got, want)
	}
}

func TestRedactPayload_LeavesEmptyAndNonObjectPayloadsAlone(t *testing.T) {
	if got := RedactPayload(decode(t, `{"key_secret": "", "token": null}`)); !reflect.DeepEqual(got, decode(t, `{"key_secret": "", "token": null}`)) {
		t.Fatalf("empty secrets = %v, want them unchanged (nothing to hide)", got)
	}
	for _, raw := range []string{`"text"`, `42`, `null`, `[1, 2]`} {
		if got, want := RedactPayload(decode(t, raw)), decode(t, raw); !reflect.DeepEqual(got, want) {
			t.Fatalf("RedactPayload(%s) = %v, want unchanged", raw, got)
		}
	}
}

func TestRedactPayload_KeepsFieldsThatOnlyLookLikeSecrets(t *testing.T) {
	// ADMIN_CREATED / ADMIN_UPDATED payloads carry is_totp_enabled, which is not a secret.
	payload := decode(t, `{"is_totp_enabled": true, "role": "manager"}`)
	if got := RedactPayload(payload); !reflect.DeepEqual(got, payload) {
		t.Fatalf("redacted = %v, want unchanged", got)
	}
}
