package workers

import (
	"context"
	"testing"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
)

func TestTemplateParametersFollowTheBodyOrder(t *testing.T) {
	vars := map[string]string{
		models.MESSAGE_REQUEST_VARIABLE_NAME:        "Asha",
		models.MESSAGE_REQUEST_VARIABLE_OTP_CODE:    "482913",
		models.MESSAGE_REQUEST_VARIABLE_TENANT_NAME: "Demo Jewellers",
	}
	body := "Hi {{name}}, {{ otp_code }} is your {{tenant_name}} code. {{unknown}}"

	got := templateParameters(body, vars)

	want := []string{"Asha", "482913", "Demo Jewellers", ""}
	if len(got) != len(want) {
		t.Fatalf("got %d parameters, want %d: %v", len(got), len(want), got)
	}
	for i, text := range want {
		if got[i]["type"] != "text" || got[i]["text"] != text {
			t.Errorf("parameter %d = %v, want text %q", i+1, got[i], text)
		}
	}
}

func TestTemplateParametersForABodyWithoutVariables(t *testing.T) {
	if got := templateParameters("Welcome!", map[string]string{"otp_code": "1"}); len(got) != 0 {
		t.Errorf("got %v, want no parameters", got)
	}
}

// A missing platform tenant or WhatsApp config must be reported, not dereferenced: the
// panic ran in the consumer goroutine and took the whole API process down.
func TestSendDefaultAPIWithoutPlatformConfig(t *testing.T) {
	configs := map[string]*models.TenantInternalConfig{
		"no platform tenant":   nil,
		"no WhatsApp config":   {},
		"no unofficial config": {WhatsAppConfig: &models.WhatsAppConfigJSON{}},
		"no endpoint": {WhatsAppConfig: &models.WhatsAppConfigJSON{
			UnofficialConfig: &models.WhatsappUnofficialTemplateConfig{},
		}},
	}
	for name, config := range configs {
		t.Run(name, func(t *testing.T) {
			consumer := &EventConsumer{DefaultTenantConfig: config}
			if err := consumer.sendDefaultAPI(context.Background(), "Your code is 1", "9876543210"); err != nil {
				t.Errorf("sendDefaultAPI() = %v, want nil (dropped and reported)", err)
			}
		})
	}
}
