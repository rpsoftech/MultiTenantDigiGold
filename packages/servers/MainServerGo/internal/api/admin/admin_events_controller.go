package admin

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
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
		// The log spans every tenant, so it is limited to platform super admins.
		middleware.RequireRole("super_admin"),
	)

	eventsGroup.Get("/", c.GetEventsList)
}

// istZone is where a from/to value without a zone offset is read: the stores and their
// admins work in Indian time. The offset is fixed (+05:30, no daylight saving).
var istZone = time.FixedZone("IST", 5*60*60+30*60)

// eventTimeLayouts are the from/to forms accepted, most specific first.
var eventTimeLayouts = []string{time.RFC3339Nano, "2006-01-02T15:04:05", "2006-01-02"}

// parseEventTime reads a from/to query value. Empty means no bound. A value without an
// offset is read as IST. The result is RFC 3339 with its offset, for a timestamptz compare.
func parseEventTime(raw string) (string, bool) {
	if raw == "" {
		return "", true
	}
	for _, layout := range eventTimeLayouts {
		var t time.Time
		var err error
		if layout == time.RFC3339Nano {
			t, err = time.Parse(layout, raw)
		} else {
			t, err = time.ParseInLocation(layout, raw, istZone)
		}
		if err == nil {
			return t.Format(time.RFC3339Nano), true
		}
	}
	return "", false
}

// GetEventsList returns the audit log, newest first. Filters: tenant_uuid, type, and
// from/to (RFC 3339, or a date or date-time in IST). Secret fields in payloads (OTP codes,
// gateway and WhatsApp credentials, ...) are redacted before they leave the server.
func (c *AdminEventsController) GetEventsList(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	limit, _ := strconv.Atoi(ctx.Query("limit", "20"))
	tenantUUID := ctx.Query("tenant_uuid", "")
	eventType := ctx.Query("type", "")

	from, okFrom := parseEventTime(ctx.Query("from", ""))
	to, okTo := parseEventTime(ctx.Query("to", ""))
	if !okFrom || !okTo {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "from and to must be dates (2026-10-09) or RFC 3339 timestamps",
			Name:       "INVALID_INPUT",
		}
	}

	list, total, err := c.tenantConfigService.GetEventsPaginated(ctx.Context(), tenantUUID, eventType, from, to, page, limit)
	if err != nil {
		return err
	}
	for _, event := range list {
		event.Payload = events.RedactPayload(event.Payload)
	}

	return ctx.JSON(fiber.Map{
		"data":  list,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
