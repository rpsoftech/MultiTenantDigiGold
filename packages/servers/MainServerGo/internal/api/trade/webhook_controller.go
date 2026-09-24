package trade_api

import (
	"encoding/json"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type WebhookController struct {
	PGService  *service.PaymentGatewayService
	ConfigRepo *repository.TenantConfigRepository
	TenantRepo *repository.TenantRepository
}

func NewWebhookController() *WebhookController {
	return &WebhookController{
		PGService:  service.InitPaymentGatewayService(),
		ConfigRepo: repository.GetTenantConfigRepository(),
		TenantRepo: repository.GetTenantRepository(),
	}
}

func (wc *WebhookController) RegisterRoutes(api fiber.Router) {
	api.Post("/webhook/razorpay", wc.RazorpayWebhook)
}

func (wc *WebhookController) RazorpayWebhook(c fiber.Ctx) error {
	signature := c.Get("X-Razorpay-Signature")
	if signature == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing signature"})
	}

	body := c.Body()

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}

	// Only a captured payment may credit gold. Acknowledge every other event
	// (payment.failed, payment.authorized, refunds...) so Razorpay stops retrying.
	if eventType, _ := payload["event"].(string); eventType != "payment.captured" {
		return c.JSON(fiber.Map{"status": "ignored"})
	}

	payloadMap, ok := payload["payload"].(map[string]interface{})
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing payload"})
	}
	paymentMap, ok := payloadMap["payment"].(map[string]interface{})
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing payment"})
	}
	entityMap, ok := paymentMap["entity"].(map[string]interface{})
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing entity"})
	}

	orderID, _ := entityMap["order_id"].(string)
	paymentID, _ := entityMap["id"].(string)
	notes, _ := entityMap["notes"].(map[string]interface{})
	if orderID == "" || paymentID == "" || notes == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "incomplete payload data"})
	}

	tenantIDStr, _ := notes["tenant_id"].(string)
	tenantID, err := strconv.ParseInt(tenantIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid tenant id"})
	}

	tenant, err := wc.TenantRepo.GetFullTenantByID(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant not found"})
	}

	config, err := wc.ConfigRepo.GetConfigByTenantUUID(c.Context(), tenant.UUID)
	if err != nil || config.PaymentConfig == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant config not found"})
	}

	webhookSecret := config.PaymentConfig.WebhookSecret
	if webhookSecret == "" {
		webhookSecret = config.PaymentConfig.KeySecret
	}
	if webhookSecret == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant webhook secret not configured"})
	}
	if err := wc.PGService.VerifyWebhookSignature(string(body), signature, webhookSecret); err != nil {
		log.Printf("⚠️ Webhook Signature Failed: %v\n", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid signature"})
	}

	// Razorpay sends amounts in paise as a JSON number.
	amountPaise, ok := entityMap["amount"].(float64)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing amount"})
	}

	if err := wc.PGService.ProcessPaymentSuccess(c.Context(), tenantID, orderID, paymentID, int64(amountPaise)); err != nil {
		log.Printf("❌ Webhook Payment Processing Failed: %v\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "processing failed"})
	}

	return c.JSON(fiber.Map{"status": "ok"})
}
