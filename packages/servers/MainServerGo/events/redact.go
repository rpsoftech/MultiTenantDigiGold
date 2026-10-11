package events

import "strings"

// RedactedValue replaces a secret in a payload served to staff.
const RedactedValue = "[redacted]"

// secretKeyParts mark a payload field as secret wherever they appear in its name, so new
// fields are covered without a list to keep in sync: OTP request events carry the live
// login code (otpCode) and tenant config events carry gateway and WhatsApp credentials.
var secretKeyParts = []string{"secret", "token", "password", "pickup_code", "api_key", "apikey", "authorization", "private_key"}

// secretKeys are matched whole: "otp" alone would also hide flags like is_totp_enabled.
var secretKeys = map[string]bool{"otp": true, "otpcode": true, "otp_code": true}

func isSecretKey(key string) bool {
	lower := strings.ToLower(key)
	if secretKeys[lower] {
		return true
	}
	for _, part := range secretKeyParts {
		if strings.Contains(lower, part) {
			return true
		}
	}
	return false
}

// RedactPayload returns a copy of a decoded JSON payload with every secret field's value
// replaced by RedactedValue, at any depth. Non-secret values are kept as they are.
func RedactPayload(payload any) any {
	switch value := payload.(type) {
	case map[string]any:
		redacted := make(map[string]any, len(value))
		for key, field := range value {
			if isSecretKey(key) && field != nil && field != "" {
				redacted[key] = RedactedValue
				continue
			}
			redacted[key] = RedactPayload(field)
		}
		return redacted
	case []any:
		redacted := make([]any, len(value))
		for i, item := range value {
			redacted[i] = RedactPayload(item)
		}
		return redacted
	default:
		return payload
	}
}
