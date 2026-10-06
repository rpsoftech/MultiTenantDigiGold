package rates_api

import (
	"bufio"

	"github.com/gofiber/fiber/v3"
)

type RateController struct {
	Hub *RateHub
}

// FIX 2: We must inject the running Hub from main.go, NOT create a new dead one!
func NewRateController(hub *RateHub) *RateController {
	return &RateController{
		Hub: hub,
	}
}

func (rc *RateController) RegisterRoutes(router fiber.Router) {
	router.Get("/stream", rc.StreamRates)
	router.Get("/last-rate", rc.LastRate)
}

func (rc *RateController) LastRate(c fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"latest_rate": rc.Hub.GetInitialRate(c.Context(), false), // Use the safe getter
	})
}

func (rc *RateController) StreamRates(c fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Access-Control-Allow-Origin", "*")
	clientChan := make(chan string, 10)
	rc.Hub.Register(clientChan)
	initialRate := rc.Hub.GetInitialRate(c.Context(), true)
	if initialRate != "" {
		clientChan <- initialRate
	}
	c.RequestCtx().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer rc.Hub.Unregister(clientChan)
		if err := w.Flush(); err != nil {
			return
		}

		for {
			select {
			case <-c.Context().Done():
				return // Client disconnected

			case payload, ok := <-clientChan:
				if !ok {
					return // Hub closed the channel
				}

				// EXPLICIT WRITE: Using WriteString makes it perfectly clear we are writing to the stream
				if _, err := w.WriteString(payload); err != nil {
					return
				}

				// PUSH TO NETWORK: Instantly push the buffered string to the user
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	})

	return nil
}
