package trade_api

import (
	"encoding/json"
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	rates_api "github.com/rpsoftech/DigiGold/MainServerGo/internal/api/rates"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type CustomerTradeController struct {
	TradeService *service.TradeService
	UserService  *service.UserService
	RateHub      *rates_api.RateHub
	PGService    *service.PaymentGatewayService
	ConfigRepo   *repository.TenantConfigRepository
	TenantRepo   *repository.TenantRepository
}

func NewCustomerTradeController(rateHub *rates_api.RateHub) *CustomerTradeController {
	return &CustomerTradeController{
		TradeService: service.InitTradeService(),
		UserService:  service.GetUserService(),
		RateHub:      rateHub,
		PGService:    service.InitPaymentGatewayService(),
		ConfigRepo:   repository.GetTenantConfigRepository(),
		TenantRepo:   repository.GetTenantRepository(),
	}
}

// RegisterRoutes mounts /trade and /user on api, guarded by the given
// middleware (tenant resolution + customer JWT).
func (tc *CustomerTradeController) RegisterRoutes(api fiber.Router, guards ...any) {
	trade := api.Group("/trade", guards...)
	trade.Post("/buy/initiate", tc.InitiateBuy)
	trade.Post("/redeem", tc.Redeem)
	trade.Get("/redemptions", tc.Redemptions)
	trade.Post("/redemptions/:uuid/cancel", tc.CancelRedemption)
	trade.Get("/history", tc.History)

	user := api.Group("/user", guards...)
	user.Get("/portfolio", tc.Portfolio)
	user.Post("/kyc", tc.UploadKYC)
}

func (tc *CustomerTradeController) InitiateBuy(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	userUUID, _ := c.Locals(middleware.LocalsKeyUserUUID).(string)

	var req interfaces.TradeExecutionRequest
	if err := c.Bind().JSON(&req); err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Invalid JSON payload",
			Name:       "INVALID_INPUT",
			Extra:      err.Error(),
		}
	}

	user, err := tc.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	// Online buys are priced by amount only: the gold credited is derived from the
	// amount actually paid, so a client cannot pay for X and ask for Y grams.
	req.WeightGrams = 0
	if req.TotalAmountINR <= 0 {
		return interfaces.ErrInvalidTradePayload
	}

	// KYC Check: Block trades > 50,000 INR if not verified
	if req.TotalAmountINR > 50000.0 && user.KYCStatus != "verified" {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusForbidden,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "KYC Verification is required for trades above 50,000 INR",
		}
	}

	req.TenantID = tenantID
	req.UserID = user.ID

	tenant, err := tc.TenantRepo.GetFullTenantByID(c.Context(), tenantID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	config, err := tc.ConfigRepo.GetConfigByTenantUUID(c.Context(), tenant.UUID)
	if err != nil || config.PaymentConfig == nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Tenant payment gateway not configured",
		}
	}

	// Lock the price now. The webhook credits gold at this quote, so a rate move
	// between order and capture cannot strand a paid order.
	quote, err := tc.TradeService.QuoteBuy(c.Context(), req)
	if err != nil {
		return err
	}

	orderID, err := tc.PGService.CreateOrder(c.Context(), req, quote, config.PaymentConfig)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success":             true,
		"order_id":            orderID,
		"amount":              quote.TotalAmountINR,
		"weight_grams":        quote.WeightGrams,
		"final_rate_per_gram": quote.FinalRatePerGram,
		"quote_expires_at":    quote.ExpiresAt,
	})
}

func (tc *CustomerTradeController) History(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	userUUID, _ := c.Locals(middleware.LocalsKeyUserUUID).(string)

	user, err := tc.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	history, err := tc.TradeService.LedgerRepo.GetTransactionHistory(c.Context(), tenantID, user.ID, limit, offset)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    history,
		"page":    page,
		"limit":   limit,
	})
}

func (tc *CustomerTradeController) Portfolio(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	userUUID, _ := c.Locals(middleware.LocalsKeyUserUUID).(string)

	user, err := tc.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	rateStr := tc.RateHub.GetInitialRate(c.Context(), false)
	var rate map[string]float64
	if rateStr != "" {
		json.Unmarshal([]byte(rateStr), &rate)
	}

	var valuation float64
	if bid, ok := rate["bid"]; ok {
		valuation = user.VaultBalance * bid // basic valuation using bid rate without margin applied
	}

	return c.JSON(fiber.Map{
		"success":               true,
		"balance_grams":         user.VaultBalance,
		"current_valuation_inr": valuation,
		"live_rate":             rate,
	})
}

// Redeem debits grams from the vault and returns a pickup code. The customer
// shows the code at the store counter to collect the physical gold.
func (tc *CustomerTradeController) Redeem(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	userUUID, _ := c.Locals(middleware.LocalsKeyUserUUID).(string)

	var req interfaces.RedemptionRequestInput
	if err := c.Bind().JSON(&req); err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Invalid JSON payload",
		}
	}

	user, err := tc.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	redemption, err := tc.TradeService.RequestRedemption(c.Context(), tenantID, user.ID, req.WeightGrams, c.IP())
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success":    true,
		"redemption": redemption,
		"message":    "Show the pickup code at the store counter to collect your gold",
	})
}

// Redemptions lists the customer's redemption requests with their pickup codes.
func (tc *CustomerTradeController) Redemptions(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	userUUID, _ := c.Locals(middleware.LocalsKeyUserUUID).(string)

	user, err := tc.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	page, limit, offset := pageParams(c)
	list, err := tc.TradeService.RedemptionRepo.ListByUser(c.Context(), tenantID, user.ID, limit, offset)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
		"page":    page,
		"limit":   limit,
	})
}

// CancelRedemption cancels the customer's own PENDING request and returns the grams to the vault.
func (tc *CustomerTradeController) CancelRedemption(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	userUUID, _ := c.Locals(middleware.LocalsKeyUserUUID).(string)

	user, err := tc.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	result, err := tc.TradeService.CancelRedemption(c.Context(), tenantID, c.Params("uuid"), user.ID, "CUSTOMER", c.IP())
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Redemption cancelled; the gold is back in your vault",
		"trade":   result,
	})
}

// pageParams reads page and limit (1-100, default 20) from the query string.
func pageParams(c fiber.Ctx) (page, limit, offset int) {
	page, _ = strconv.Atoi(c.Query("page", "1"))
	limit, _ = strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return page, limit, (page - 1) * limit
}

func (tc *CustomerTradeController) UploadKYC(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	userUUID, _ := c.Locals(middleware.LocalsKeyUserUUID).(string)

	var payload map[string]interface{}
	if err := c.Bind().JSON(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}

	docJSON, err := json.Marshal(payload)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to encode doc"})
	}

	user, err := tc.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	if err := tc.UserService.UserRepo.UpdateUserDocumentJSON(c.Context(), user.ID, docJSON); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update kyc"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "KYC document uploaded and pending verification"})
}
