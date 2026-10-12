package constants

const (
	// RedisPubSubChannelRawRates is the channel where your external feed publishes real-time ticks
	RedisPubSubChannelRawRates = "rate/GOLD"

	// RedisKeyLatestRawRate is the string key holding the latest snapshot JSON
	RedisKeyLatestRawRate = "LastRate"
)
