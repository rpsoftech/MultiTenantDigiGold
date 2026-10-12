package workers

import (
	"testing"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
)

func TestMockLPHedgingEnabled(t *testing.T) {
	cases := []struct {
		appEnv env.AppEnv
		flag   string
		want   bool
	}{
		{env.APP_ENV_LOCAL, "", false},
		{env.APP_ENV_STAGING, "false", false},
		{env.APP_ENV_STAGING, "true", true},
		{env.APP_ENV_LOCAL, "true", true},
		// Simulated fills must never be booked in production, flag or not.
		{env.APP_ENV_PRODUCTION, "true", false},
	}
	for _, c := range cases {
		if got := MockLPHedgingEnabled(c.appEnv, c.flag); got != c.want {
			t.Errorf("MockLPHedgingEnabled(%s, %q) = %v, want %v", c.appEnv, c.flag, got, c.want)
		}
	}
}
