package workers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
)

// processWhatsAppOTP isolates the messy 3rd-party API logic
func (c *EventConsumer) processWhatsAppOTP(ctx context.Context, baseEvent events.BaseEvent) error {
	// 1. Rehydrate the dynamic interface{} Payload back into JSON bytes
	payloadBytes, err := json.Marshal(baseEvent.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload interface: %w", err)
	}

	// 2. Unmarshal into the strictly-typed OTPRequest struct we created earlier
	var otpReq interfaces.OTPRequest
	if err := json.Unmarshal(payloadBytes, &otpReq); err != nil {
		return fmt.Errorf("failed to parse WhatsApp OTP payload: %w", err)
	}

	if otpReq.TenantId == "" {
		return fmt.Errorf("tenantId is required")
	}

	tenant, err := c.TenantRepo.GetFullTenantByUUID(ctx, otpReq.TenantId)
	if err != nil {
		return err
	}
	// 3. Format the actual WhatsApp message text
	msgText := fmt.Sprintf(
		"Welcome to %s,\n\n%s! Your secure login OTP is %s.\n\n\nDo not share this with anyone.",
		tenant.FullName,
		otpReq.Name,
		otpReq.OtpCode,
	)

	// 4. Execute the Third-Party API Call (e.g., Msg91, Twilio, Meta Graph API)
	// TODO: Replace this with your actual HTTP client call to your WhatsApp provider
	err = c.mockSendWhatsAppAPI(otpReq.Phone, msgText)
	if err != nil {
		// Returning the error tells the Consumer to skip the "MarkEventAsProcessed" step
		return fmt.Errorf("whatsapp API rejected the request: %w", err)
	}

	return nil
}

// mockSendWhatsAppAPI simulates the network call
func (c *EventConsumer) mockSendWhatsAppAPI(phone string, message string) error {
	log.Printf("--> [WHATSAPP API TRIGGERED] Sending to %s: %s\n", phone, message)
	// Simulate 200ms network latency
	// time.Sleep(200 * time.Millisecond)
	return nil
}
