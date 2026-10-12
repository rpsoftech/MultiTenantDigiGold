package service

import (
	"context"
	"fmt"
	"log"
	"sync"

	"github.com/google/uuid"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

var (
	masterHedgingServiceInstance *MasterHedgingService
	masterHedgingServiceOnce     sync.Once
)

type MasterHedgingService struct {
	DB          *postgres.PostgresDBStruct
	HedgingRepo *repository.HedgingRepository
	LotSize     float64
}

func InitMasterHedgingService() *MasterHedgingService {
	masterHedgingServiceOnce.Do(func() {
		masterHedgingServiceInstance = &MasterHedgingService{
			DB:          postgres.GetPostgresDB(),
			HedgingRepo: repository.InitHedgingRepo(),
			LotSize:     100.0, // Configurable threshold (e.g. 100g)
		}
	})
	return masterHedgingServiceInstance
}

func (s *MasterHedgingService) ProcessHedgingCycle(ctx context.Context) error {
	// Begin Transaction to lock the master state
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	// 1. Lock state
	state, err := s.HedgingRepo.GetStateForUpdateWithTX(ctx, tx)
	if err != nil {
		return fmt.Errorf("failed to lock master hedging state: %w", err)
	}

	// 2. Check if we reached the lot size
	if state.UnhedgedGrams < s.LotSize {
		// Nothing to hedge
		_ = tx.Rollback()
		return nil
	}

	// Calculate how many full lots we can hedge
	numberOfLots := int(state.UnhedgedGrams / s.LotSize)
	totalHedgeAmount := float64(numberOfLots) * s.LotSize

	log.Printf("[HedgingService] Threshold reached! Unhedged: %f, Hedging: %f", state.UnhedgedGrams, totalHedgeAmount)

	// 3. Create a PENDING order in DB
	order := &models.MasterHedgingOrder{
		LotWeightGrams: totalHedgeAmount,
		Status:         "PENDING",
	}

	if err := s.HedgingRepo.CreateHedgingOrderWithTX(ctx, tx, order); err != nil {
		return fmt.Errorf("failed to create pending order: %w", err)
	}

	// 4. MOCK LP EXECUTION
	// In production, this would make an HTTP call to the LP API.
	// For now, we simulate a successful fill at a mock rate.
	mockRate := 7100.50
	mockTotal := totalHedgeAmount * mockRate
	mockRef := "LP_MOCK_" + uuid.New().String()

	order.Status = "FILLED"
	order.LPExecutionRate = &mockRate
	order.LPTotalAmountINR = &mockTotal
	order.LPOrderReference = &mockRef

	// 5. Update order to FILLED
	if err := s.HedgingRepo.UpdateHedgingOrderWithTX(ctx, tx, order); err != nil {
		return fmt.Errorf("failed to update filled order: %w", err)
	}

	// 6. Deduct from unhedged, add to total hedged
	newUnhedged := state.UnhedgedGrams - totalHedgeAmount
	newTotalHedged := state.TotalHedgedGrams + totalHedgeAmount

	if err := s.HedgingRepo.UpdateStateWithTX(ctx, tx, newUnhedged, newTotalHedged); err != nil {
		return fmt.Errorf("failed to update hedging state: %w", err)
	}

	// 7. Commit Transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit hedging cycle tx: %w", err)
	}

	log.Printf("✅ [HedgingService] Successfully hedged %f grams. New Unhedged: %f", totalHedgeAmount, newUnhedged)
	return nil
}
