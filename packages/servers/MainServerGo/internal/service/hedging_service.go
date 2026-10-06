package service

import (
	"context"
	"fmt"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

var (
	hedgingServiceInstance *HedgingService
	hedgingServiceOnce     sync.Once
)

type HedgingService struct {
	DB          *postgres.PostgresDBStruct
	HedgingRepo *repository.HedgingRepository
}

func InitHedgingService() *HedgingService {
	hedgingServiceOnce.Do(func() {
		hedgingServiceInstance = &HedgingService{
			DB:          postgres.GetPostgresDB(),
			HedgingRepo: repository.InitHedgingRepo(),
		}
	})
	return hedgingServiceInstance
}

func (s *HedgingService) UpdateHedgingBuffer(ctx context.Context, additionalGrams float64) error {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	state, err := s.HedgingRepo.GetStateForUpdateWithTX(ctx, tx)
	if err != nil {
		return fmt.Errorf("failed to get hedging state: %w", err)
	}

	newUnhedgedGrams := state.UnhedgedGrams + additionalGrams

	err = s.HedgingRepo.UpdateStateWithTX(ctx, tx, newUnhedgedGrams, state.TotalHedgedGrams)
	if err != nil {
		return fmt.Errorf("failed to update hedging state: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
