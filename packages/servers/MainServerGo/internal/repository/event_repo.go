package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/lib/pq" // Required for PostgreSQL Array types

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"

	// Ensure this import matches your actual Redis utility path
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type EventRepository struct {
	DB    *postgres.PostgresDBStruct
	Redis *redis_client.RedisClientStruct // 1. ADD REDIS TO THE STRUCT

	// Prepared Statements
	stmtInsertEvent      *sql.Stmt
	stmtMarkProcessed    *sql.Stmt
	stmtFetchUnprocessed *sql.Stmt
}

var (
	eventRepoInstance *EventRepository
	eventRepoOnce     sync.Once
)

// GetEventRepository implements Thread-Safe Lazy Initialization
func GetEventRepository() *EventRepository {
	eventRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		rdb := redis_client.InitRedisClient() // 2. INITIALIZE REDIS

		// 1. INSERT QUERY (Saving the BaseEvent)
		queryInsert := `
            INSERT INTO system_events (
                event_id, key_id, tenant_id, event_name, is_processed, 
                parent_names, payload, ip_address_occurred_from, admin_id, occurred_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

		stmtInsert, err := db.Db.Prepare(queryInsert)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare InsertEvent: %v", err))
		}

		// 2. MARK AS PROCESSED
		queryMark := `UPDATE system_events SET is_processed = true WHERE event_id = $1`
		stmtMark, err := db.Db.Prepare(queryMark)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare MarkEventProcessed: %v", err))
		}

		// 3. FETCH UNPROCESSED
		queryFetch := `
            SELECT 
                event_id, key_id, tenant_id, event_name, parent_names, 
                payload, ip_address_occurred_from, admin_id, occurred_at 
            FROM system_events 
            WHERE is_processed = false AND occurred_at < NOW() - INTERVAL '1 minute'
            ORDER BY occurred_at ASC 
            LIMIT 100`

		stmtFetch, err := db.Db.Prepare(queryFetch)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare FetchUnprocessedEvents: %v", err))
		}

		eventRepoInstance = &EventRepository{
			DB:                   db,
			Redis:                rdb, // 3. MAP REDIS TO THE INSTANCE
			stmtInsertEvent:      stmtInsert,
			stmtMarkProcessed:    stmtMark,
			stmtFetchUnprocessed: stmtFetch,
		}
	})
	return eventRepoInstance
}

// ==========================================
// WRITE OPERATIONS
// ==========================================

// SaveEvent serializes the dynamic payload, saves the event outbox record, AND dispatches it to Redis
func (r *EventRepository) SaveEvent(event *events.BaseEvent) error {
	bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return r.SaveEventWithContext(bgCtx, event)
}
func (r *EventRepository) SaveEventWithContext(ctx context.Context, event *events.BaseEvent) error {
	// Convert the dynamic interface{} payload into JSON bytes for the PostgreSQL JSONB column [cite: 766]
	payloadBytes, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal event payload: %w", err)
	}

	// Ensure empty strings are treated as NULL in the database for optional fields
	var adminID sql.NullString
	if event.AdminId != "" {
		adminID.String = event.AdminId
		adminID.Valid = true
	}

	var ipAddress sql.NullString
	if event.IpAddressAOccurredFrom != "" {
		ipAddress.String = event.IpAddressAOccurredFrom
		ipAddress.Valid = true
	}

	// 1. SAVE TO POSTGRESQL (The Outbox)
	_, err = r.stmtInsertEvent.ExecContext(ctx,
		event.Id,
		event.KeyId,
		event.TenantId,
		event.EventName,
		event.IsProcessed, // Defaults to false
		pq.Array(event.ParentNames),
		payloadBytes,
		ipAddress,
		adminID,
		event.OccurredAt,
	)

	// If the database fails, we absolutely abort. We do not publish to Redis.
	if err != nil {
		return err
	}

	// 2. FIRE AND FORGET: DISPATCH TO REDIS
	// This only triggers if the PostgreSQL insert was completely successful.
	go func(evt *events.BaseEvent) {
		// By adding a 5-second timeout to the background context, you guarantee that if Redis hangs, the background thread gracefully dies instead of leaking memory[cite: 696].
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if pubErr := r.Redis.PublishEvent(bgCtx, evt); pubErr != nil {
			// Trigger a critical log here so you know Redis dropped the message.
			// Your PostgreSQL Cron job will pick this up automatically because is_processed is still false!
			fmt.Printf("CRITICAL: Failed to publish Event %s to Redis: %v\n", evt.Id, pubErr)
		}
	}(event)

	return nil
}

// SaveEventWithTx executes the outbox insert within an active transaction, then dispatches to Redis
func (r *EventRepository) SaveEventWithTx(ctx context.Context, tx *sql.Tx, event *events.BaseEvent) error {
	payloadBytes, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal event payload: %w", err)
	}

	var adminID sql.NullString
	if event.AdminId != "" {
		adminID.String = event.AdminId
		adminID.Valid = true
	}

	var ipAddress sql.NullString
	if event.IpAddressAOccurredFrom != "" {
		ipAddress.String = event.IpAddressAOccurredFrom
		ipAddress.Valid = true
	}

	// 1. SYNCHRONOUS INSERT USING THE TRANSACTION
	_, err = tx.StmtContext(ctx, r.stmtInsertEvent).ExecContext(ctx,
		event.Id, event.KeyId, event.TenantId, event.EventName,
		event.IsProcessed, pq.Array(event.ParentNames), payloadBytes,
		ipAddress, adminID, event.OccurredAt,
	)

	if err != nil {
		return err // The Service layer will catch this and Rollback() everything
	}

	// 2. FIRE AND FORGET REDIS DISPATCH
	go func(evt *events.BaseEvent) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if pubErr := r.Redis.PublishEvent(bgCtx, evt); pubErr != nil {
			fmt.Printf("CRITICAL: Failed to publish Event %s to Redis: %v\n", evt.Id, pubErr)
		}
	}(event)

	return nil
}

// MarkEventAsProcessed is called by the background worker instantly after success
func (r *EventRepository) MarkEventAsProcessed(ctx context.Context, eventID string) error {
	_, err := r.stmtMarkProcessed.ExecContext(ctx, eventID)
	return err
}

// ==========================================
// OUTBOX RECOVERY OPERATIONS
// ==========================================

// FetchUnprocessedEvents grabs up to 100 failed/dropped events for the Cron recovery job
func (r *EventRepository) FetchUnprocessedEvents(ctx context.Context) ([]*events.BaseEvent, error) {
	rows, err := r.stmtFetchUnprocessed.QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var unprocessedEvents []*events.BaseEvent

	for rows.Next() {
		var evt events.BaseEvent
		var adminID, ipAddress sql.NullString
		var payloadBytes []byte

		err := rows.Scan(
			&evt.Id,
			&evt.KeyId,
			&evt.TenantId,
			&evt.EventName,
			pq.Array(&evt.ParentNames), // Unpacks PostgreSQL TEXT[] back to Go []string
			&payloadBytes,
			&ipAddress,
			&adminID,
			&evt.OccurredAt,
		)
		if err != nil {
			return nil, err
		}

		// Rehydrate the dynamic JSON payload into a raw map
		if err := json.Unmarshal(payloadBytes, &evt.Payload); err != nil {
			return nil, err
		}

		if adminID.Valid {
			evt.AdminId = adminID.String
		}
		if ipAddress.Valid {
			evt.IpAddressAOccurredFrom = ipAddress.String
		}

		evt.ObjId = evt.Id // Restore the BSON alias
		evt.IsProcessed = false

		unprocessedEvents = append(unprocessedEvents, &evt)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return unprocessedEvents, nil
}
