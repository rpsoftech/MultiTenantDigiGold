package admin

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type AdminStoreController struct {
	TradeService *service.TradeService
	UserService  *service.UserService
}

func NewAdminStoreController() *AdminStoreController {
	return &AdminStoreController{
		TradeService: service.InitTradeService(),
		UserService:  service.GetUserService(),
	}
}

func (ac *AdminStoreController) RegisterRoutes(api fiber.Router) {
	am := middleware.GetAdminAuthMiddleware()

	// Apply authentication and tenant injection securely
	storeGroup := api.Group("/store",
		middleware.TenantInterceptor,
		am.Intercept,
		middleware.RequireRole(middleware.RoleSuperAdmin, middleware.RoleManager),
	)
	storeGroup.Get("/customers", ac.Customers)
	storeGroup.Get("/ledger", ac.Ledger)
	storeGroup.Post("/ledger/reverse", ac.ReverseTrade)
	storeGroup.Get("/analytics", ac.Analytics)
	storeGroup.Post("/trade/counter", ac.CounterTrade)

	kycGroup := storeGroup.Group("/kyc")
	kycGroup.Get("/pending", ac.PendingKYC)
	kycGroup.Post("/approve", ac.ApproveKYC)
	kycGroup.Post("/reject", ac.RejectKYC)

	redemptionGroup := storeGroup.Group("/redemptions")
	redemptionGroup.Get("/pending", ac.PendingRedemptions)
	redemptionGroup.Post("/fulfill", ac.FulfillRedemption)
}

func (ac *AdminStoreController) Customers(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	users, err := ac.UserService.UserRepo.GetUsersByTenant(c.Context(), tenantID, limit, offset)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    users,
		"page":    page,
		"limit":   limit,
	})
}

func (ac *AdminStoreController) Ledger(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	ledger, err := ac.TradeService.LedgerRepo.GetLedgerByTenant(c.Context(), tenantID, limit, offset)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    ledger,
		"page":    page,
		"limit":   limit,
	})
}

func (ac *AdminStoreController) CounterTrade(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	adminUUID := middleware.GetAdminUUID(c)

	var body struct {
		interfaces.TradeExecutionRequest
		UserUUID string `json:"user_uuid"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Invalid JSON payload",
		}
	}
	req := body.TradeExecutionRequest

	// Resolve the customer strictly inside the admin's tenant. Internal user IDs
	// from the request body are never trusted.
	user, err := ac.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, body.UserUUID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}
	req.TenantID = tenantID
	req.UserID = user.ID

	if req.Action != "BUY" && req.Action != "SELL" {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "action must be BUY or SELL",
		}
	}

	// Counter trades are settled in store; online modes are reserved for the payment gateway.
	switch req.PaymentMode {
	case "":
		req.PaymentMode = "COUNTER_CASH"
	case "COUNTER_CASH", "COUNTER_UPI":
	default:
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "payment_mode must be COUNTER_CASH or COUNTER_UPI",
		}
	}

	ipAddress := c.IP()

	result, err := ac.TradeService.ExecuteTrade(c.Context(), req, ipAddress, adminUUID)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"trade":   result,
	})
}
func (ac *AdminStoreController) PendingKYC(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	users, err := ac.UserService.UserRepo.GetPendingKYCUsersByTenant(c.Context(), tenantID, limit, offset)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    users,
		"page":    page,
		"limit":   limit,
	})
}

func (ac *AdminStoreController) ApproveKYC(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)

	var payload map[string]string
	if err := c.Bind().JSON(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}

	userUUID := payload["user_uuid"]
	if userUUID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing user_uuid"})
	}

	user, err := ac.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "user not found in tenant"})
	}

	if err := ac.UserService.UserRepo.UpdateUserKYCStatus(c.Context(), user.ID, "verified", nil); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to approve kyc"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "KYC approved"})
}

func (ac *AdminStoreController) RejectKYC(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)

	var payload map[string]string
	if err := c.Bind().JSON(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}

	userUUID := payload["user_uuid"]
	if userUUID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing user_uuid"})
	}

	user, err := ac.UserService.UserRepo.GetFullUserByUUID(c.Context(), tenantID, userUUID)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "user not found in tenant"})
	}

	if err := ac.UserService.UserRepo.UpdateUserKYCStatus(c.Context(), user.ID, "rejected", nil); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to reject kyc"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "KYC rejected"})
}
func (ac *AdminStoreController) Analytics(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)

	analytics, err := ac.TradeService.LedgerRepo.GetTenantAnalytics(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch analytics"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    analytics,
	})
}
func (ac *AdminStoreController) ReverseTrade(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	adminUUID := middleware.GetAdminUUID(c)
	ipAddress := c.IP()

	var payload map[string]string
	if err := c.Bind().JSON(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}

	ledgerUUID := payload["ledger_uuid"]
	if ledgerUUID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing ledger_uuid"})
	}

	result, err := ac.TradeService.ReverseTransaction(c.Context(), tenantID, ledgerUUID, adminUUID, ipAddress)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Transaction reversed",
		"trade":   result,
	})
}
func (ac *AdminStoreController) PendingRedemptions(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	list, err := ac.TradeService.RedemptionRepo.GetPendingRedemptions(c.Context(), tenantID, limit, offset)
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

func (ac *AdminStoreController) FulfillRedemption(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)

	var payload struct {
		UUID           string `json:"rf_uuid"`
		CourierName    string `json:"courier_name"`
		TrackingNumber string `json:"tracking_number"`
	}
	if err := c.Bind().JSON(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json payload"})
	}
	if payload.UUID == "" || payload.CourierName == "" || payload.TrackingNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing required fields"})
	}

	err := ac.TradeService.RedemptionRepo.FulfillRedemption(c.Context(), tenantID, payload.UUID, payload.CourierName, payload.TrackingNumber)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Redemption fulfilled and marked as SHIPPED",
	})
}
