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
type WhatsappConfigProviderType string

const (
	DEFAULTWhatsappConfigProvider WhatsappConfigProviderType = "DEFAULT"
	OFFICIAL                      WhatsappConfigProviderType = "OFFICIAL"
	UNOFFICIAL                    WhatsappConfigProviderType = "UNOFFICIAL"
)

type WhatsappMessageTemplateType string

const (
	OTPRequest WhatsappMessageTemplateType = "OTP_REQUEST"
)

type WhatsappProviderApiEndpoint struct {
	// API Credentials (Blank if using "DEFAULT")
	APIEndpoint string `json:"api_endpoint" validate:"required"`
	AuthToken   string `json:"auth_token" validate:"required"`
}

type WhatsappUnofficialTemplateConfig struct {
	*WhatsappProviderApiEndpoint
}
type WhatsappOfficialTemplateConfig struct {
	*WhatsappProviderApiEndpoint
	PhoneNumberID string `json:"phone_number_id" validate:"required"`
}

type WhatsappMessageTemplate struct {
	Name     string `json:"name" validate:"required"`
	Body     string `json:"body" validate:"required"`
	Language string `json:"language" validate:"required"`
	// Optional: "language": {"code": "en"}
}

// WhatsAppConfigJSON defines the dynamic rules for sending messages
type WhatsAppConfigJSON struct {
	// ProviderType can be "DEFAULT" (Voltra), "OFFICIAL" (Meta), or "UNOFFICIAL" (Custom)
	ProviderType     WhatsappConfigProviderType        `json:"provider_type" validate:"required"`
	OfficialConfig   *WhatsappOfficialTemplateConfig   `json:"official_config,omitempty"`
	UnofficialConfig *WhatsappUnofficialTemplateConfig `json:"unofficial_config,omitempty"`
	// Template Mappings: Maps internal event names to the provider's specific template IDs
	// e.g., {"login_otp": "template_xyz123", "payment_success": "template_abc987"}
	TemplateMappings map[WhatsappMessageTemplateType]WhatsappMessageTemplate `json:"template_mappings,omitempty"`
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

const (
	MESSAGE_REQUEST_VARIABLE_TENANT_ID   = "tenant_id"
	MESSAGE_REQUEST_VARIABLE_TENANT_NAME = "tenant_name"
	MESSAGE_REQUEST_VARIABLE_PHONE       = "phone"
	MESSAGE_REQUEST_VARIABLE_NAME        = "name"
	MESSAGE_REQUEST_VARIABLE_OTP_CODE    = "otp_code"
)
