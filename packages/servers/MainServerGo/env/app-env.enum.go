package env

import (
	"strings"

	"github.com/rpsoftech/DigiGold/MainServerGo/validator"
)

type AppEnv string

const (
	APP_ENV_DEVELOP    AppEnv = "DEVELOP"
	APP_ENV_STAGING    AppEnv = "STAGING"
	APP_ENV_LOCAL      AppEnv = "LOCAL"
	APP_ENV_CI         AppEnv = "CI"
	APP_ENV_PRODUCTION AppEnv = "PRODUCTION"
)

var (
	appEnvMap = map[string]AppEnv{
		"DEVELOP":    APP_ENV_DEVELOP,
		"STAGING":    APP_ENV_STAGING,
		"LOCAL":      APP_ENV_LOCAL,
		"CI":         APP_ENV_CI,
		"PRODUCTION": APP_ENV_PRODUCTION,
	}
)

func init() {
	validator.RegisterEnumValidatorFunc("AppEnv", validateEnumAppEnv)
}

func validateEnumAppEnv(value string) bool {
	_, ok := parseAppEnv(value)
	return ok
}

func parseAppEnv(str string) (AppEnv, bool) {
	c, ok := appEnvMap[strings.ToUpper(str)]
	return c, ok
}

func (s AppEnv) String() string {
	switch s {
	case APP_ENV_DEVELOP:
		return "DEVELOP"
	case APP_ENV_STAGING:
		return "STAGING"
	case APP_ENV_LOCAL:
		return "LOCAL"
	case APP_ENV_CI:
		return "CI"
	case APP_ENV_PRODUCTION:
		return "PRODUCTION"
	}
	return "unknown"
}

// Valid checks if the AppEnv is valid.
//
// It takes no parameters.
// It returns a boolean value.
func (s AppEnv) Valid() bool {
	switch s {
	case
		APP_ENV_LOCAL,
		APP_ENV_CI,
		APP_ENV_PRODUCTION:
		return true
	}

	return false
}
