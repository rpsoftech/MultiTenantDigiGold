package redis_client

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	"github.com/rpsoftech/DigiGold/MainServerGo/events"

	"github.com/redis/go-redis/v9"
)

type RedisClientConfig struct {
	REDIS_DB_HOST          string `json:"REDIS_DB_HOST" validate:"required"`
	REDIS_DB_PORT          int    `json:"REDIS_DB_PORT" validate:"required,port"`
	REDIS_DB_PASSWORD      string `json:"REDIS_DB_PASSWORD" validate:"required"`
	REDIS_DB_USERNAME      string `json:"REDIS_DB_USERNAME"`
	REDIS_DB_DATABASE      int    `json:"REDIS_DB_DATABASE" validate:"min=0,max=100"`
	Redis_DB_KEY_PREFIX    string `validate:"required"`
	Redis_DB_CHANEL_PREFIX string `validate:"required"`
}

type RedisClientStruct struct {
	Client *redis.Client
	Config *RedisClientConfig
}

const (
	TimeToLive_OneHour time.Duration = time.Hour
	TimeToLive_OneDay  time.Duration = time.Hour * 24
)

var (
	redisInstance *RedisClientStruct
	redisOnce     sync.Once
)

// InitRedisClient initializes and validates the Redis connection synchronously.
func InitRedisClient() *RedisClientStruct {
	redisOnce.Do(func() {
		redisDBDatabase, err := strconv.Atoi(env.Env.GetEnv(env.REDIS_DB_DATABASE_KEY))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Invalid REDIS_DB_DATABASE: %v", err))
		}

		redisDBPort, err := strconv.Atoi(env.Env.GetEnv(env.REDIS_DB_PORT_KEY))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Invalid REDIS_DB_PORT: %v", err))
		}

		config := &RedisClientConfig{
			REDIS_DB_PORT:          redisDBPort,
			REDIS_DB_HOST:          env.Env.GetEnv(env.REDIS_DB_HOST_KEY),
			REDIS_DB_PASSWORD:      env.Env.GetEnv(env.REDIS_DB_PASSWORD_KEY),
			REDIS_DB_DATABASE:      redisDBDatabase,
			REDIS_DB_USERNAME:      env.Env.GetEnv(env.REDIS_DB_USERNAME_KEY),
			Redis_DB_KEY_PREFIX:    env.Env.GetEnv(env.REDIS_DEFAULT_KEY_KEY),
			Redis_DB_CHANEL_PREFIX: env.Env.GetEnv(env.REDIS_DEFAULT_CHANNEL_KEY),
		}

		env.ValidateEnv(config)

		client := redis.NewClient(&redis.Options{
			Addr:     fmt.Sprintf("%v:%d", config.REDIS_DB_HOST, config.REDIS_DB_PORT),
			Password: config.REDIS_DB_PASSWORD,
			DB:       config.REDIS_DB_DATABASE,
			Username: config.REDIS_DB_USERNAME,
		})

		// Synchronous ping: Ensure connection is actually alive before returning
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := client.Ping(ctx).Err(); err != nil {
			panic(fmt.Sprintf("FATAL: Could not connect to Redis: %v", err))
		}

		redisInstance = &RedisClientStruct{
			Client: client,
			Config: config,
		}
		println("Redis Client Initialized Successfully")
		log.Printf("🔗 Redis Target: %s", client.Options().Addr)
	})

	return redisInstance
}

func DeferFunction() {
	if redisInstance != nil && redisInstance.Client != nil {
		if err := redisInstance.Client.Close(); err != nil {
			// Log error instead of panicking on shutdown
			fmt.Printf("Error closing Redis connection: %v\n", err)
		}
	}
}

// ==========================================
// DATA METHODS (Context & Error Enforced)
// ==========================================

// func (r *RedisClientStruct) SubscribeToChannels(ctx context.Context, channels ...string) *redis.PubSub {
// 	return r.Client.Subscribe(ctx, channels...)
// }

func (r *RedisClientStruct) PublishEvent(ctx context.Context, event events.BaseEventInterface) error {
	return r.PublishCustomEvent(ctx, event.GetEventName(), event.GetPayloadString())
}

func (r *RedisClientStruct) PublishCustomEvent(ctx context.Context, event string, payload string) error {
	return r.Client.Publish(ctx, r.GetRedisEventKey(event), payload).Err()
}

// func (r *RedisClientStruct) GetHashValue(ctx context.Context, key string) (map[string]string, error) {
// 	return r.Client.HGetAll(ctx, key).Result()
// }

func (r *RedisClientStruct) GetStringData(ctx context.Context, key string) (string, error) {
	return r.Client.Get(ctx, r.GetRedisKey(key)).Result()
}

func (r *RedisClientStruct) RemoveKey(ctx context.Context, key ...string) error {
	for i, k := range key {
		key[i] = r.GetRedisKey(k)
	}
	return r.Client.Del(ctx, key...).Err()
}

func (r *RedisClientStruct) SetStringDataKeepTTL(ctx context.Context, key string, value string) error {
	return r.Client.Set(ctx, r.GetRedisKey(key), value, redis.KeepTTL).Err()
}
func (r *RedisClientStruct) SetStringData(ctx context.Context, key string, value string, expiresIn int) error {
	return r.SetStringDataWithExpiry(ctx, key, value, time.Duration(expiresIn)*time.Second)
}

func (r *RedisClientStruct) SetStringDataWithExpiry(ctx context.Context, key string, value string, expiresIn time.Duration) error {
	return r.Client.Set(ctx, r.GetRedisKey(key), value, expiresIn).Err()
}

//	func (r *RedisClientStruct) Generate(ctx context.Context, key string, values map[string]string) error {
//		return r.Client.HMSet(ctx, key, values).Err()
//	}
func (r *RedisClientStruct) GetRedisKey(key string) string {
	return r.Config.Redis_DB_KEY_PREFIX + key
}
func (r *RedisClientStruct) GetRedisEventKey(key string) string {
	return r.Config.Redis_DB_CHANEL_PREFIX + key
}
