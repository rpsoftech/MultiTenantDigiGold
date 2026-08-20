package rates_api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
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
	latestRateString string
	sseLatestRate    string // 🚨 NEW: Store the pre-formatted SSE string here
	rateMu           sync.RWMutex
}

func NewRateHub() *RateHub {
	return &RateHub{
		Redis:    redis_client.InitRedisClient(),
		clients:  make(map[chan string]bool),
		AllRates: &RateStruct{}, // Avoids nil pointer panic when unmarshaling JSON
	}
}

func (h *RateHub) Start(ctx context.Context) {
	// 1. Attempt to fetch initial rates from Redis Hash
	allRateString, err := h.Redis.GetHashKeyWithOriginalKey(ctx, constants.RedisKeyLatestRawRate, "GOLD")

	if err == nil && allRateString != "" {
		h.setLatestRate(allRateString)
		log.Printf("📦 Initial Rate Hydrated from Redis: %f", h.latestRate)
	} else {
		log.Println("⚠️ No initial rate snapshot found in Redis key. Awaiting live ticks...")
	}

	// 2. Connect to the PubSub Stream
	pubsub := h.Redis.Client.Subscribe(ctx, constants.RedisPubSubChannelRawRates)
	defer pubsub.Close()

	log.Printf("📡 Global Rate Hub subscribed to channel [%s]...", constants.RedisPubSubChannelRawRates)
	ch := pubsub.Channel()

	// 3. Central Broadcast Loop
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

			// ONLY broadcast if the Delta Check proves the price actually changed
			if h.setLatestRate(msg.Payload) {
				h.broadcast(h.sseLatestRate)
			}
		}
	}
}

func (h *RateHub) GetInitialRate(ctx context.Context) string {
	h.rateMu.RLock()
	cached := h.sseLatestRate // 🚨 Return the pre-formatted string
	h.rateMu.RUnlock()

	if cached != "" {
		return cached
	}

	// Fallback to Redis Hash if RAM is empty
	val, err := h.Redis.GetHashKeyWithOriginalKey(ctx, constants.RedisKeyLatestRawRate, "GOLD")
	if err == nil && val != "" {
		h.setLatestRate(val)
		return h.sseLatestRate
	}

	return ""
}

func (h *RateHub) setLatestRate(rate string) bool {
	h.rateMu.Lock()
	defer h.rateMu.Unlock()
	// Graceful error handling in case Redis sends bad JSON
	if err := json.Unmarshal([]byte(rate), h.AllRates); err != nil {
		log.Printf("⚠️ Failed to parse rate from Redis: %v", err)
		return false
	}

	if h.AllRates.Ask != h.latestRate {
		h.latestRate = h.AllRates.Ask
		h.latestRateString = strconv.FormatFloat(h.latestRate, 'f', -1, 64)
		h.sseLatestRate = fmt.Sprintf("data: %d\n\n", h.latestRateString)
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
			// Non-blocking drop: skip users with frozen connections
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
