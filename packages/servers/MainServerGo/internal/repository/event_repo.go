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
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/schema"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"

	// Ensure this import matches your actual Redis utility path
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/monitoring"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type EventRepository struct {
	DB    *postgres.PostgresDBStruct
	Redis *redis_client.RedisClientStruct // 1. ADD REDIS TO THE STRUCT

	// Prepared Statements
	stmtInsertEvent      *sql.Stmt
	stmtMarkProcessed    *sql.Stmt
	stmtClaim            *sql.Stmt
	stmtRelease          *sql.Stmt
	stmtFetchUnprocessed *sql.Stmt
	stmtGetEvents        *sql.Stmt
	stmtCountEvents      *sql.Stmt
}

var (
	eventRepoInstance *EventRepository
	eventRepoOnce     sync.Once
)

// GetEventRepository implements Thread-Safe Lazy Initialization
// GetEventRepository implements Thread-Safe Lazy Initialization
func GetEventRepository() *EventRepository {
	eventRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		rdb := redis_client.InitRedisClient()

		// 1. INSERT QUERY (Using Schema Constants)
		queryInsert := fmt.Sprintf(`
            INSERT INTO %s (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			schema.TableSystemEvents,
			schema.ColEventId, schema.ColKeyId, schema.ColTenantId, schema.ColEventName, schema.ColIsProcessed,
			schema.ColParentNames, schema.ColPayload, schema.ColIpAddressOccurredFrom, schema.ColAdminId, schema.ColOccurredAt,
		)

		stmtInsert, err := db.Db.Prepare(queryInsert)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare InsertEvent: %v", err))
		}

		// 2. MARK AS PROCESSED (Using Schema Constants)
		queryMark := fmt.Sprintf(`UPDATE %s SET %s = true WHERE %s = $1`,
			schema.TableSystemEvents, schema.ColIsProcessed, schema.ColEventId,
		)

		stmtMark, err := db.Db.Prepare(queryMark)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare MarkEventProcessed: %v", err))
		}

		// 2b. CLAIM / RELEASE: atomic compare-and-set so that only one consumer
		// (API process, worker process, or cron republish) handles an event.
		stmtClaim, err := db.Db.Prepare(fmt.Sprintf(`UPDATE %s SET %s = true WHERE %s = $1 AND %s = false`,
			schema.TableSystemEvents, schema.ColIsProcessed, schema.ColEventId, schema.ColIsProcessed,
		))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare ClaimEvent: %v", err))
		}
		stmtRelease, err := db.Db.Prepare(fmt.Sprintf(`UPDATE %s SET %s = false WHERE %s = $1`,
			schema.TableSystemEvents, schema.ColIsProcessed, schema.ColEventId,
		))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare ReleaseEvent: %v", err))
		}

		// 3. FETCH UNPROCESSED (Using Schema Constants)
		queryFetch := fmt.Sprintf(`
            SELECT 
                %s, %s, %s, %s, %s, %s, %s, %s, %s 
            FROM %s 
            WHERE %s = false AND %s < NOW() - INTERVAL '1 minute'
            ORDER BY %s ASC 
            LIMIT 100`,
			schema.ColEventId, schema.ColKeyId, schema.ColTenantId, schema.ColEventName, schema.ColParentNames,
			schema.ColPayload, schema.ColIpAddressOccurredFrom, schema.ColAdminId, schema.ColOccurredAt,
			schema.TableSystemEvents,
			schema.ColIsProcessed, schema.ColOccurredAt,
			schema.ColOccurredAt,
		)

		stmtFetch, err := db.Db.Prepare(queryFetch)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare FetchUnprocessedEvents: %v", err))
		}

		queryGetEvents := fmt.Sprintf(`
			SELECT 
				%s, %s, %s, %s, %s, %s, %s, %s, %s 
			FROM %s 
			WHERE ($1 = '' OR %s = $1) 
			  AND ($2 = '' OR %s = $2)
			  AND ($3 = '' OR %s >= cast(nullif($3, '') as timestamp))
			  AND ($4 = '' OR %s <= cast(nullif($4, '') as timestamp))
			ORDER BY %s DESC 
			LIMIT $5 OFFSET $6`,
			schema.ColEventId, schema.ColKeyId, schema.ColTenantId, schema.ColEventName, schema.ColParentNames,
			schema.ColPayload, schema.ColIpAddressOccurredFrom, schema.ColAdminId, schema.ColOccurredAt,
			schema.TableSystemEvents,
			schema.ColTenantId, schema.ColEventName, schema.ColOccurredAt, schema.ColOccurredAt, schema.ColOccurredAt,
		)

		stmtGetEvents, err := db.Db.Prepare(queryGetEvents)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare stmtGetEvents: %v", err))
		}

		queryCountEvents := fmt.Sprintf(`
			SELECT COUNT(*)
			FROM %s 
			WHERE ($1 = '' OR %s = $1) 
			  AND ($2 = '' OR %s = $2)
			  AND ($3 = '' OR %s >= cast(nullif($3, '') as timestamp))
			  AND ($4 = '' OR %s <= cast(nullif($4, '') as timestamp))`,
			schema.TableSystemEvents,
			schema.ColTenantId, schema.ColEventName, schema.ColOccurredAt, schema.ColOccurredAt,
		)

		stmtCountEvents, err := db.Db.Prepare(queryCountEvents)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare stmtCountEvents: %v", err))
		}

		eventRepoInstance = &EventRepository{
			DB:                   db,
			Redis:                rdb,
			stmtInsertEvent:      stmtInsert,
			stmtMarkProcessed:    stmtMark,
			stmtClaim:            stmtClaim,
			stmtRelease:          stmtRelease,
			stmtFetchUnprocessed: stmtFetch,
			stmtGetEvents:        stmtGetEvents,
			stmtCountEvents:      stmtCountEvents,
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
			monitoring.Critical(bgCtx, monitoring.KindEventPublish, fmt.Errorf("event %s not published to Redis: %w", evt.Id, pubErr))
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

	// The event is NOT published here: the transaction may still roll back.
	// Callers publish with PublishAsync after Commit; anything not published
	// is picked up by the outbox recovery cron.
	return err // The Service layer will catch this and Rollback() everything
}

// PublishAsync dispatches already-committed events to Redis without blocking the caller.
func (r *EventRepository) PublishAsync(evts ...*events.BaseEvent) {
	for _, evt := range evts {
		go func(evt *events.BaseEvent) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if pubErr := r.Redis.PublishEvent(bgCtx, evt); pubErr != nil {
				monitoring.Critical(bgCtx, monitoring.KindEventPublish, fmt.Errorf("event %s not published to Redis: %w", evt.Id, pubErr))
			}
		}(evt)
	}
}

// ClaimEvent atomically marks an unprocessed event as processed. It returns false
// when the event does not exist (yet) or another consumer already claimed it.
func (r *EventRepository) ClaimEvent(ctx context.Context, eventID string) (bool, error) {
	return claim(r.stmtClaim.ExecContext(ctx, eventID))
}

// ClaimEventWithTx claims an event inside tx, so the claim commits or rolls back
// together with the side effects of processing it (exactly-once).
func (r *EventRepository) ClaimEventWithTx(ctx context.Context, tx *sql.Tx, eventID string) (bool, error) {
	return claim(tx.StmtContext(ctx, r.stmtClaim).ExecContext(ctx, eventID))
}

// ReleaseEvent returns a claimed event to the outbox so the recovery cron retries it.
func (r *EventRepository) ReleaseEvent(ctx context.Context, eventID string) error {
	_, err := r.stmtRelease.ExecContext(ctx, eventID)
	return err
}

func claim(res sql.Result, err error) (bool, error) {
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return n == 1, nil
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

func (r *EventRepository) GetEventsPaginated(ctx context.Context, tenantUUID, eventType, from, to string, limit, offset int) ([]*events.BaseEvent, int64, error) {
	var total int64
	err := r.stmtCountEvents.QueryRowContext(ctx, tenantUUID, eventType, from, to).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := r.stmtGetEvents.QueryContext(ctx, tenantUUID, eventType, from, to, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var pagedEvents []*events.BaseEvent
	for rows.Next() {
		var evt events.BaseEvent
		var payloadBytes []byte
		var parentNames pq.StringArray
		var ipAddress sql.NullString
		var adminID sql.NullString

		if err := rows.Scan(
			&evt.Id, &evt.KeyId, &evt.TenantId, &evt.EventName, &parentNames,
			&payloadBytes, &ipAddress, &adminID, &evt.OccurredAt,
		); err != nil {
			return nil, 0, err
		}

		evt.ParentNames = parentNames

		if err := json.Unmarshal(payloadBytes, &evt.Payload); err != nil {
			return nil, 0, err
		}

		if adminID.Valid {
			evt.AdminId = adminID.String
		}
		if ipAddress.Valid {
			evt.IpAddressAOccurredFrom = ipAddress.String
		}

		evt.ObjId = evt.Id
		pagedEvents = append(pagedEvents, &evt)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, err
	}

	return pagedEvents, total, nil
}
