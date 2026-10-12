package env

import (
	"strings"
	"testing"
)

func TestParseAppEnvIgnoresCase(t *testing.T) {
	for _, value := range []string{"PRODUCTION", "production", "Production"} {
		if got, ok := parseAppEnv(value); !ok || got != APP_ENV_PRODUCTION {
			t.Errorf("parseAppEnv(%q) = %q, %v; want %q, true", value, got, ok, APP_ENV_PRODUCTION)
		}
	}
}

// An APP_ENV that is not one of the known values must stop startup: the production guards
// compare against APP_ENV_PRODUCTION, so "PROD" would silently switch them all off.
func TestValidateEnvRejectsUnknownAppEnv(t *testing.T) {
	valid := func(appEnv AppEnv) *EnvInterface {
		return &EnvInterface{
			APP_ENV:           appEnv,
			PORT:              8080,
			ACCESS_TOKEN_KEY:  strings.Repeat("a", 100),
			REFRESH_TOKEN_KEY: strings.Repeat("b", 100),
		}
	}

	validates := func(e *EnvInterface) (ok bool) {
		defer func() {
			if recover() != nil {
				ok = false
			}
		}()
		ValidateEnv(e)
		return true
	}

	if !validates(valid(APP_ENV_PRODUCTION)) {
		t.Fatal("APP_ENV=PRODUCTION was rejected")
	}
	for _, value := range []AppEnv{"PROD", "live", ""} {
		if validates(valid(value)) {
			t.Errorf("APP_ENV=%q was accepted", string(value))
		}
	}
}
