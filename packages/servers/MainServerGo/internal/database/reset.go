package database

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// ResetSchema drops the schema with everything in it (tables, data, the migration version)
// and creates it again empty. MigrateUp then builds it from 000001_init. Only for databases
// whose data may be thrown away.
func ResetSchema(ctx context.Context, db *sql.DB, schema string) error {
	if schema == "" {
		return fmt.Errorf("no schema name given")
	}
	if _, err := db.ExecContext(ctx, fmt.Sprintf(`DROP SCHEMA IF EXISTS %q CASCADE; CREATE SCHEMA %q;`, schema, schema)); err != nil {
		return fmt.Errorf("failed to reset schema %q: %w", schema, err)
	}
	return nil
}

// ClearCachedKeys deletes every Redis key starting with prefix (the app's REDIS_DEFAULT_KEY):
// cached rows, sessions, OTPs and locks that point at data a reset removed. Keys outside the
// prefix, such as the live gold rate, are kept. An empty prefix deletes nothing, since it
// would match every key in the Redis database. Returns how many keys were deleted.
func ClearCachedKeys(ctx context.Context, rdb *redis.Client, prefix string) (int, error) {
	if prefix == "" {
		return 0, fmt.Errorf("no Redis key prefix set (REDIS_DEFAULT_KEY): refusing to delete every key")
	}
	deleted := 0
	iter := rdb.Scan(ctx, 0, prefix+"*", 500).Iterator()
	batch := make([]string, 0, 500)
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		if err := rdb.Del(ctx, batch...).Err(); err != nil {
			return fmt.Errorf("failed to delete cached keys: %w", err)
		}
		deleted += len(batch)
		batch = batch[:0]
		return nil
	}
	for iter.Next(ctx) {
		batch = append(batch, iter.Val())
		if len(batch) == cap(batch) {
			if err := flush(); err != nil {
				return deleted, err
			}
		}
	}
	if err := iter.Err(); err != nil {
		return deleted, fmt.Errorf("failed to list cached keys: %w", err)
	}
	return deleted, flush()
}
