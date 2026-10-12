package rates_api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/constants"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type RateStruct struct {
	Bid  float64 `json:"bid"`
	Ask  float64 `json:"ask"`
	High float64 `json:"last-high"`
	Low  float64 `json:"last-low"`
}

type RateHub struct {
	Redis            *redis_client.RedisClientStruct
	clients          map[chan string]bool
	AllRates         *RateStruct
	mu               sync.RWMutex
	latestRate       float64
	latestRateString string // holds the raw JSON payload
	sseLatestRate    string // holds the pre-formatted SSE string
	rateMu           sync.RWMutex
}

func NewRateHub() *RateHub {
	return &RateHub{
		Redis:    redis_client.InitRedisClient(),
		clients:  make(map[chan string]bool),
		AllRates: &RateStruct{},
	}
}

func (h *RateHub) Start(ctx context.Context) {
	allRateString, err := h.Redis.GetHashKeyWithOriginalKey(ctx, constants.RedisKeyLatestRawRate, "GOLD")

	if err == nil && allRateString != "" {
		h.setLatestRate(allRateString)
		log.Printf("📦 Initial Rate Hydrated from Redis: %f", h.latestRate)
	} else {
		log.Println("⚠️ No initial rate snapshot found in Redis key. Awaiting live ticks...")
	}

	pubsub := h.Redis.Client.Subscribe(ctx, constants.RedisPubSubChannelRawRates)
	defer pubsub.Close()

	log.Printf("📡 Global Rate Hub subscribed to channel [%s]...", constants.RedisPubSubChannelRawRates)
	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Shutting down Rate Hub...")
			return
		case msg, ok := <-ch:
			if !ok {
				log.Println("⚠️ Rate Hub Redis channel closed.")
				return
			}

			if h.setLatestRate(msg.Payload) {
				h.broadcast(h.sseLatestRate)
			}
		}
	}
}

func (h *RateHub) GetInitialRate(ctx context.Context, withDataString bool) string {
	h.rateMu.RLock()
	cached := h.latestRateString
	if withDataString {
		cached = h.sseLatestRate
	}
	h.rateMu.RUnlock()

	if cached != "" {
		return cached
	}

	val, err := h.Redis.GetHashKeyWithOriginalKey(ctx, constants.RedisKeyLatestRawRate, "GOLD")
	if err == nil && val != "" {
		h.setLatestRate(val)
		if withDataString {
			return h.sseLatestRate
		}
		return h.latestRateString
	}

	return ""
}

func (h *RateHub) setLatestRate(rate string) bool {
	h.rateMu.Lock()
	defer h.rateMu.Unlock()

	if err := json.Unmarshal([]byte(rate), h.AllRates); err != nil {
		log.Printf("⚠️ Failed to parse rate from Redis: %v", err)
		return false
	}

	if h.AllRates.Ask != h.latestRate {
		h.latestRate = h.AllRates.Ask
		h.latestRateString = rate // Broadcast the full JSON object
		h.sseLatestRate = fmt.Sprintf("data: %s\n\n", h.latestRateString)
		return true
	}
	return false
}

func (h *RateHub) broadcast(payload string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for clientChan := range h.clients {
		select {
		case clientChan <- payload:
		default:
		}
	}
}

func (h *RateHub) Register(clientChan chan string) {
	h.mu.Lock()
	h.clients[clientChan] = true
	h.mu.Unlock()
}

func (h *RateHub) Unregister(clientChan chan string) {
	h.mu.Lock()
	if _, exists := h.clients[clientChan]; exists {
		delete(h.clients, clientChan)
		close(clientChan)
	}
	h.mu.Unlock()
}
