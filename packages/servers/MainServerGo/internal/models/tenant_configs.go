package models

import "time"

// TenantInternalConfig maps directly to the PostgreSQL table
type TenantInternalConfig struct {
	ID             int64               `json:"-"` // Hidden from frontend
	UUID           string              `json:"uuid"`
	TenantID       int64               `json:"-"`
	WhatsAppConfig *WhatsAppConfigJSON `json:"whatsapp_config,omitempty"`
	PaymentConfig  *PaymentConfigJSON  `json:"payment_config,omitempty"`
	OthersConfig   *OthersConfigJSON   `json:"other_config,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	ModifiedAt     time.Time           `json:"modified_at"`
}

// WhatsAppConfigJSON defines the dynamic rules for sending messages
type WhatsAppConfigJSON struct {
	// ProviderType can be "DEFAULT" (Voltra), "OFFICIAL" (Meta), or "UNOFFICIAL" (Custom)
	ProviderType string `json:"provider_type"`

	// API Credentials (Blank if using "DEFAULT")
	APIEndpoint string `json:"api_endpoint,omitempty"`
	AuthToken   string `json:"auth_token,omitempty"`

	// Template Mappings: Maps internal event names to the provider's specific template IDs
	// e.g., {"login_otp": "template_xyz123", "payment_success": "template_abc987"}
	TemplateMappings map[string]string `json:"template_mappings,omitempty"`
}

// PaymentConfigJSON handles custom Razorpay / PayU credentials
type PaymentConfigJSON struct {
	ProviderType string `json:"provider_type"` // "DEFAULT" (Voltra) or "CUSTOM"
	KeyID        string `json:"key_id,omitempty"`
	KeySecret    string `json:"key_secret,omitempty"`
}

// OthersConfigJSON handles outbound webhooks for the tenant's own external systems
type OthersConfigJSON struct {
	Webhooks WebhooksConfigJSON `json:"webhooks"`
}
type WebhooksConfigJSON struct {
	IsEnabled     bool   `json:"is_enabled"`
	WebhookURL    string `json:"webhook_url,omitempty"`
	WebhookSecret string `json:"webhook_secret,omitempty"` // For calculating HMAC signatures
}
