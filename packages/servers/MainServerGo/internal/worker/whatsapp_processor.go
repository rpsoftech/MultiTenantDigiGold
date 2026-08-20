package workers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
)

type UnofficialWhatsappSendTextBody struct {
	To  []string `json:"to"`
	Msg string   `json:"msg"`
}

// processWhatsAppOTP is called by the Central Event Consumer
func (c *EventConsumer) processWhatsAppOTP(ctx context.Context, baseEvent events.BaseEvent) error {
	// 1. Rehydrate Payload
	payloadBytes, _ := json.Marshal(baseEvent.Payload)
	var otpReq interfaces.OTPRequest
	if err := json.Unmarshal(payloadBytes, &otpReq); err != nil {
		c.handleCriticalError(otpReq.TenantId, baseEvent.EventName, fmt.Errorf("failed to parse payload: %w", err))
		return nil // Return nil to drop the malformed event permanently
	}

	tenant, err := c.TenantRepo.GetPartialTenantByUUID(ctx, otpReq.TenantId)
	if err != nil {
		c.handleCriticalError(otpReq.TenantId, baseEvent.EventName, fmt.Errorf("failed to fetch tenant: %w", err))
		return nil
	}
	// 2. Fetch Configuration
	config, err := c.ConfigRepo.GetConfigByTenantUUID(ctx, otpReq.TenantId)
	if err != nil || config == nil || config.WhatsAppConfig == nil {
		c.handleCriticalError(otpReq.TenantId, baseEvent.EventName, fmt.Errorf("whatsapp config missing or DB error"))
		return nil // Drop event to prevent infinite Cron retries
	}
	waConfig := config.WhatsAppConfig

	// 3. Extract the Specific Template
	template, exists := waConfig.TemplateMappings[models.OTPRequest]
	if !exists {
		c.handleCriticalError(otpReq.TenantId, baseEvent.EventName, fmt.Errorf("OTP_REQUEST template not mapped"))
		return nil // Drop event
	}

	// 4. Regex Compile the Message Body
	// Define all possible variables the template might request
	templateVars := map[string]string{
		models.MESSAGE_REQUEST_VARIABLE_NAME:        otpReq.Name,
		models.MESSAGE_REQUEST_VARIABLE_OTP_CODE:    otpReq.OtpCode,
		models.MESSAGE_REQUEST_VARIABLE_PHONE:       otpReq.Phone,
		models.MESSAGE_REQUEST_VARIABLE_TENANT_NAME: tenant.FullName,
		// "company_name": config.OtherConfig.CompanyName, (if available in future)
	}
	finalMessageBody := compileMessageTemplate(template.Body, templateVars)

	// 5. Route to the correct API Provider
	var apiErr error
	switch waConfig.ProviderType {
	case models.OFFICIAL:
		if waConfig.OfficialConfig == nil {
			c.handleCriticalError(otpReq.TenantId, baseEvent.EventName, fmt.Errorf("official config selected but credentials missing"))
			return nil
		}
		apiErr = c.sendMetaOfficialAPI(waConfig.OfficialConfig, template.Name, templateVars, otpReq.Phone)

	case models.UNOFFICIAL:
		if waConfig.UnofficialConfig == nil {
			c.handleCriticalError(otpReq.TenantId, baseEvent.EventName, fmt.Errorf("unofficial config selected but credentials missing"))
			return nil
		}
		apiErr = c.sendCustomUnofficialAPI(waConfig.UnofficialConfig, finalMessageBody, otpReq.Phone)
	case models.DEFAULTWhatsappConfigProvider:
		apiErr = c.sendDefaultAPI(finalMessageBody, otpReq.Phone)
	default:
		c.handleCriticalError(otpReq.TenantId, baseEvent.EventName, fmt.Errorf("unknown provider type: %s", waConfig.ProviderType))
		return nil
	}
	// 6. Network/API Error Handling
	if apiErr != nil {
		return fmt.Errorf("whatsapp API failure: %w", apiErr)
	}
	return nil // Success! Central Consumer will mark it as processed.
}

// ==========================================
// THE SPECIFIC API ADAPTERS
// ==========================================

// sendCustomUnofficialAPI sends the fully Regex-compiled string to a custom endpoint
func (c *EventConsumer) sendCustomUnofficialAPI(creds *models.WhatsappUnofficialTemplateConfig, compiledMessage string, phone string) error {
	payload := &UnofficialWhatsappSendTextBody{
		To:  []string{phone},
		Msg: compiledMessage,
	}
	return c.sendWhatsappTextMessage(creds.APIEndpoint, creds.AuthToken, payload)
}

// sendDefaultAPI uses your own fixed server configuration
func (c *EventConsumer) sendDefaultAPI(compiledMessage string, phone string) error {

	waConfig := c.DefaultTenantConfig.WhatsAppConfig
	if waConfig.UnofficialConfig == nil {
		c.handleCriticalError("default", "OTPEvent", fmt.Errorf("unofficial config selected but credentials missing"))
		return nil
	}
	return c.sendCustomUnofficialAPI(waConfig.UnofficialConfig, compiledMessage, phone)

}

// sendMetaOfficialAPI maps the variables directly to Meta's strict component structure
func (c *EventConsumer) sendMetaOfficialAPI(creds *models.WhatsappOfficialTemplateConfig, templateName string, vars map[string]string, phone string) error {

	// Convert our map into Meta's strict positional array parameter format
	var parameters []map[string]string
	for _, val := range vars {
		parameters = append(parameters, map[string]string{
			"type": "text",
			"text": val,
		})
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                phone,
		"type":              "template",
		"template": map[string]interface{}{
			"name":     templateName,
			"language": map[string]string{"code": "en"}, // Ideally derived from template config
			"components": []map[string]interface{}{
				{
					"type":       "body",
					"parameters": parameters,
				},
			},
		},
	}

	// Meta's endpoint requires the Phone Number ID in the URL
	endpoint := fmt.Sprintf("%s/%s/messages", creds.APIEndpoint, creds.PhoneNumberID)
	// req.Header.Set("Authorization", "Bearer "+token``,token)

	return c.executeHTTPRequest(endpoint, "Authorization", "Bearer "+creds.AuthToken, payload)
}
func (c *EventConsumer) sendWhatsappTextMessage(endpoint string, token string, payload *UnofficialWhatsappSendTextBody) error {
	return c.executeHTTPRequest(endpoint, "X-Api-Token", token, payload)
}

// executeHTTPRequest is a reusable HTTP client with strict timeouts
func (c *EventConsumer) executeHTTPRequest(endpoint string, tokenKey string, token string, payload any) error {
	jsonPayload, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonPayload))

	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set(tokenKey, token)
	}

	// Strict 10-second circuit breaker. Never let a 3rd party API hang your workers.
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

// handleCriticalError is a stub for future integration (e.g., Sentry, Slack Alerts, Datadog)
func (c *EventConsumer) handleCriticalError(tenantID string, eventName string, err error) {
	log.Printf("🚨 CRITICAL ALERT [Tenant: %s] [Event: %s]: %v\n", tenantID, eventName, err)
	// TODO: Push this error to a monitoring queue or Slack webhook in the future
}

// compileMessageTemplate replaces {{variable_name}} with actual map values
func compileMessageTemplate(templateBody string, variables map[string]string) string {
	// Matches anything inside {{ }}
	re := regexp.MustCompile(`\{\{(.*?)\}\}`)
	return re.ReplaceAllStringFunc(templateBody, func(match string) string {
		// Strip the {{ and }} and trim spaces
		key := strings.TrimSpace(match[2 : len(match)-2])

		if val, exists := variables[key]; exists {
			return val
		}
		// If the variable isn't in our map, leave it unparsed so developers can spot the missing data
		return match
	})
}
