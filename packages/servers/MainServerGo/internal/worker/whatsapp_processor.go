package workers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
)

// processWhatsAppOTP is called by the Central Event Consumer
func (c *EventConsumer) processWhatsAppOTP(ctx context.Context, baseEvent events.BaseEvent) error {
	// 1. Rehydrate the dynamic interface{} Payload
	payloadBytes, _ := json.Marshal(baseEvent.Payload)
	var otpReq interfaces.OTPRequest
	if err := json.Unmarshal(payloadBytes, &otpReq); err != nil {
		return fmt.Errorf("failed to parse WhatsApp OTP payload: %w", err)
	}

	// 2. Fetch the Tenant's specific API Configuration
	// Note: We inject a ConfigRepo into the EventConsumer struct to make this call
	config, err := c.ConfigRepo.GetConfigByTenantUUID(ctx, otpReq.TenantId)
	if err != nil {
		// If no config exists, we default to the "DEFAULT"  to prevent a crash
		log.Printf("⚠️ No custom config found for tenant %s, falling back to DEFAULT", otpReq.TenantId)
	}

	// 3. Format the actual message
	msgText := fmt.Sprintf(
		"Welcome to %s, %s! Your secure login OTP is %s. Do not share this with anyone.",
		"",
		otpReq.Name,
		otpReq.OtpCode,
	)

	// 4. Route the request based on the JSONB Provider Type [cite: 2272, 2273, 2274]
	var apiErr error
	provider := "DEFAULT"
	if config != nil && config.WhatsAppConfig.ProviderType != "" {
		provider = config.WhatsAppConfig.ProviderType
	}

	switch provider {
	case "OFFICIAL":
		apiErr = c.sendMetaOfficialAPI(config.WhatsAppConfig, otpReq.Phone, otpReq.OtpCode)
	case "UNOFFICIAL":
		apiErr = c.sendCustomUnofficialAPI(config.WhatsAppConfig, otpReq.Phone, msgText)
	default:
		apiErr = c.sendAkshatGoldDefaultAPI(otpReq.Phone, msgText)
	}

	// 5. Error Handling & The Outbox Safety Net
	if apiErr != nil {
		// Returning an error here tells the Central Consumer NOT to mark the event as processed.
		// The Safety Net Cron Job will pick this up in 1 minute and retry automatically.
		return fmt.Errorf("whatsapp API provider [%s] failed: %w", provider, apiErr)
	}

	return nil
}

// ==========================================
// THE SPECIFIC API ADAPTERS
// ==========================================

func (c *EventConsumer) sendMetaOfficialAPI(config *models.WhatsAppConfigJSON, phone string, otp string) error {
	// Meta requires highly structured template payloads
	templateID := config.TemplateMappings["login_otp"]
	if templateID == "" {
		return fmt.Errorf("missing template mapping for login_otp")
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                phone,
		"type":              "template",
		"template": map[string]interface{}{
			"name":     templateID,
			"language": map[string]string{"code": "en"},
			"components": []map[string]interface{}{
				{
					"type":       "body",
					"parameters": []map[string]string{{"type": "text", "text": otp}},
				},
			},
		},
	}
	return c.executeHTTPRequest(config.APIEndpoint, config.AuthToken, payload)
}

func (c *EventConsumer) sendCustomUnofficialAPI(config *models.WhatsAppConfigJSON, phone string, message string) error {
	// Unofficial APIs usually just take a raw string message
	payload := map[string]interface{}{
		"number":  phone,
		"message": message,
	}
	return c.executeHTTPRequest(config.APIEndpoint, config.AuthToken, payload)
}

func (c *EventConsumer) sendAkshatGoldDefaultAPI(phone string, message string) error {
	// TODO: Replace with your actual Msg91 or default provider credentials
	log.Printf("--> [DEFAULT WHATSAPP API] Sending to %s: %s\n", phone, message)
	return nil
}

// executeHTTPRequest is a reusable HTTP client with strict timeouts
func (c *EventConsumer) executeHTTPRequest(endpoint string, token string, payload interface{}) error {
	jsonPayload, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonPayload))

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	// Strict 10-second timeout. If the 3rd party API hangs, our worker refuses to hang with it.
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)

	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("API rejected request with status code: %d", resp.StatusCode)
	}
	return nil
}
