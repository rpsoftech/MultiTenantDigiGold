package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/lib/pq" // Required for PostgreSQL Array types

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type EventRepository struct {
	DB *postgres.PostgresDBStruct

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

		// 2. MARK AS PROCESSED (The Fast Path for Background Workers)
		queryMark := `UPDATE system_events SET is_processed = true WHERE event_id = $1`
		stmtMark, err := db.Db.Prepare(queryMark)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare MarkEventProcessed: %v", err))
		}

		// 3. FETCH UNPROCESSED (The Safety Net Cron Job)
		// Uses the partial index (is_processed = false) to fetch events older than 1 minute instantly
		queryFetch := `
			SELECT 
				event_id, key_id, tenant_id, event_name, parent_names, 
				payload, ip_address_occurred_from, admin_id, occurred_at 
			FROM system_events 
			WHERE is_processed = false AND occurred_at < NOW() - INTERVAL '1 minute'
			ORDER BY occurred_at ASC 
			LIMIT 100` // Chunked processing to prevent memory spikes

		stmtFetch, err := db.Db.Prepare(queryFetch)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare FetchUnprocessedEvents: %v", err))
		}

		eventRepoInstance = &EventRepository{
			DB:                   db,
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

// SaveEvent serializes the dynamic payload and saves the event outbox record
func (r *EventRepository) SaveEvent(ctx context.Context, event *events.BaseEvent) error {
	// Convert the dynamic interface{} payload into JSON bytes for the PostgreSQL JSONB column [cite: 711]
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

	_, err = r.stmtInsertEvent.ExecContext(ctx,
		event.Id,
		event.KeyId,
		event.TenantId,
		event.EventName,
		event.IsProcessed,
		pq.Array(event.ParentNames), // Converts Go []string to PostgreSQL TEXT[]
		payloadBytes,
		ipAddress,
		adminID,
		event.OccurredAt,
	)

	return err
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

		// Rehydrate the dynamic JSON payload into a raw map (or let the worker handle specific unmarshaling)
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
