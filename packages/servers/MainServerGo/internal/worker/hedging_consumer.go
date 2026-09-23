package workers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

func (c *EventConsumer) processTradeGoldPurchase(ctx context.Context, baseEvent events.BaseEvent) error {
	var ledger models.GoldTransactionLedger

	// baseEvent.Payload is interface{}, so we need to remarshal it to parse into struct
	payloadBytes, err := json.Marshal(baseEvent.Payload)
	if err != nil {
		return fmt.Errorf("failed to remarshal payload: %w", err)
	}

	if err := json.Unmarshal(payloadBytes, &ledger); err != nil {
		return fmt.Errorf("failed to unmarshal gold transaction ledger: %w", err)
	}

	// Calculate the delta (gold sold to customer increases our unhedged exposure)
	// Typically, a purchase means we owe gold, so unhedged increases.
	deltaGrams := ledger.WeightGrams

	// If it's a physical redemption or sell, delta might be negative.
	// We assume WeightGrams is properly signed from the Trade Service.

	// Begin Transaction for locking
	db := postgres.GetPostgresDB()
	tx, err := db.Db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin tx for hedging update: %w", err)
	}
	defer tx.Rollback()

	// 1. Lock the Master Hedging State
	state, err := c.HedgingRepo.GetStateForUpdateWithTX(ctx, tx)
	if err != nil {
		return fmt.Errorf("failed to lock master hedging state: %w", err)
	}

	// 2. Compute New State
	newUnhedged := state.UnhedgedGrams + deltaGrams

	// 3. Update DB
	if err := c.HedgingRepo.UpdateStateWithTX(ctx, tx, newUnhedged, state.TotalHedgedGrams); err != nil {
		return fmt.Errorf("failed to update master hedging state: %w", err)
	}

	// Commit Transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit hedging update tx: %w", err)
	}

	return nil
}
