package repository

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type HedgingRepository struct {
	DB                    *postgres.PostgresDBStruct
	stmtGetStateForUpdate *sql.Stmt
	stmtUpdateState       *sql.Stmt
}

var (
	hedgingRepoInstance *HedgingRepository
	hedgingRepoOnce     sync.Once
)

func InitHedgingRepo() *HedgingRepository {
	hedgingRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()

		queryGet := "SELECT mhs_id, mhs_unhedged_grams, mhs_total_hedged_grams, mhs_last_hedged_at FROM master_hedging_state WHERE mhs_id = 1 FOR UPDATE"
		stmtGet, err := db.Db.Prepare(queryGet)
		if err != nil {
			panic(fmt.Errorf("fatal: failed to prepare GetStateForUpdate: %w", err))
		}

		queryUpdate := "UPDATE master_hedging_state SET mhs_unhedged_grams = $1, mhs_total_hedged_grams = $2, mhs_updated_at = NOW() WHERE mhs_id = 1"
		stmtUpdate, err := db.Db.Prepare(queryUpdate)
		if err != nil {
			panic(fmt.Errorf("fatal: failed to prepare UpdateState: %w", err))
		}

		hedgingRepoInstance = &HedgingRepository{
			DB:                    db,
			stmtGetStateForUpdate: stmtGet,
			stmtUpdateState:       stmtUpdate,
		}
	})
	return hedgingRepoInstance
}

func (r *HedgingRepository) GetStateForUpdateWithTX(ctx context.Context, tx *sql.Tx) (*models.MasterHedgingState, error) {
	var state models.MasterHedgingState

	err := tx.StmtContext(ctx, r.stmtGetStateForUpdate).QueryRowContext(ctx).Scan(
		&state.ID, &state.UnhedgedGrams, &state.TotalHedgedGrams, &state.LastHedgedAt,
	)

	if err == sql.ErrNoRows {
		// If singleton does not exist, create it
		insertQuery := "INSERT INTO master_hedging_state (mhs_id, mhs_unhedged_grams, mhs_total_hedged_grams) VALUES (1, 0.0, 0.0) ON CONFLICT (mhs_id) DO NOTHING"
		_, err = tx.ExecContext(ctx, insertQuery)
		if err != nil {
			return nil, fmt.Errorf("failed to seed master hedging state: %w", err)
		}

		// Re-fetch under the lock
		err = tx.StmtContext(ctx, r.stmtGetStateForUpdate).QueryRowContext(ctx).Scan(
			&state.ID, &state.UnhedgedGrams, &state.TotalHedgedGrams, &state.LastHedgedAt,
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to fetch and lock master hedging state: %w", err)
	}

	return &state, nil
}

func (r *HedgingRepository) UpdateStateWithTX(ctx context.Context, tx *sql.Tx, unhedgedGrams, totalHedgedGrams float64) error {
	_, err := tx.StmtContext(ctx, r.stmtUpdateState).ExecContext(ctx, unhedgedGrams, totalHedgedGrams)
	if err != nil {
		return fmt.Errorf("failed to update master hedging state: %w", err)
	}
	return nil
}
