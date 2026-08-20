package rates

import (
	"bufio"
	"context"
	"fmt"
	"log"

	"github.com/gofiber/fiber/v3"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type RateController struct {
	Redis *redis_client.RedisClientStruct
}

func NewRateController() *RateController {
	return &RateController{
		Redis: redis_client.InitRedisClient(),
	}
}

func (rc *RateController) RegisterRoutes(router fiber.Router) {
	// The frontend will connect to GET /api/v1/rates/stream
	router.Get("/stream", rc.StreamLiveRates)
}

func (rc *RateController) StreamLiveRates(c fiber.Ctx) error {
	// 1. Set the mandatory SSE HTTP Headers
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Access-Control-Allow-Origin", "*")

	// 2. Take hijack control of the underlying TCP stream using Fiber's StreamWriter
	c.RequestCtx().SetBodyStreamWriter(func(w *bufio.Writer) {
		log.Println("🟢 Client connected to Live Rate Stream")

		// Create a context that cancels when the client closes their browser/tab
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Subscribe specifically to the raw global feed
		pubsub := rc.Redis.Client.Subscribe(ctx, "global:raw_gold_rate")
		defer pubsub.Close()

		ch := pubsub.Channel()

		// 3. The Infinite Streaming Loop
		for {
			select {
			case <-c.Context().Done():
				// Fiber detected the client disconnected
				log.Println("🔴 Client disconnected from Rate Stream")
				return

			case msg, ok := <-ch:
				if !ok {
					return // Redis channel closed
				}

				// SSE format requires "data: {payload}\n\n"
				eventPayload := fmt.Sprintf("data: %s\n\n", msg.Payload)

				// Write to the TCP buffer
				if _, err := w.WriteString(eventPayload); err != nil {
					log.Println("⚠️ Failed to write to client, closing stream.")
					return
				}

				// Flush pushes the buffer through the network to the Angular frontend instantly
				if err := w.Flush(); err != nil {
					log.Println("⚠️ Failed to flush stream, client likely dropped.")
					return
				}
			}
		}
	})

	return nil
}
