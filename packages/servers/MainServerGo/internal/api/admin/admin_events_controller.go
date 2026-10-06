package admin

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type AdminEventsController struct {
	tenantConfigService *service.TenantConfigService
}

func NewAdminEventsController() *AdminEventsController {
	return &AdminEventsController{
		tenantConfigService: service.GetTenantConfigService(),
	}
}

func (c *AdminEventsController) RegisterRoutes(router fiber.Router) {
	am := middleware.GetAdminAuthMiddleware()
	eventsGroup := router.Group("/events",
		middleware.TenantInterceptor,
		am.Intercept,
		middleware.RequireRole("super_admin", "auditor"), // Auditor can view events
	)

	eventsGroup.Get("/", c.GetEventsList)
}

func (c *AdminEventsController) GetEventsList(ctx fiber.Ctx) error {
	pageStr := ctx.Query("page", "1")
	limitStr := ctx.Query("limit", "20")
	tenantUUID := ctx.Query("tenant_uuid", "")
	eventType := ctx.Query("type", "")
	from := ctx.Query("from", "")
	to := ctx.Query("to", "")

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)

	events, total, err := c.tenantConfigService.GetEventsPaginated(ctx.Context(), tenantUUID, eventType, from, to, page, limit)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"data":  events,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
