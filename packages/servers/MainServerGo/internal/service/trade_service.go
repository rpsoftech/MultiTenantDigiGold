package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/constants"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

var (
	tradeServiceInstance *TradeService
	tradeServiceOnce     sync.Once
)

type TradeService struct {
	DB         *postgres.PostgresDBStruct
	Redis      *redis_client.RedisClientStruct
	LedgerRepo *repository.GoldLedgerRepository
	EventRepo  *repository.EventRepository
	MarginRepo *repository.MarginRepository
}

func InitTradeService() *TradeService {
	tradeServiceOnce.Do(func() {
		tradeServiceInstance = &TradeService{
			DB:         postgres.GetPostgresDB(),
			Redis:      redis_client.InitRedisClient(),
			LedgerRepo: repository.InitGoldLedgerRepo(),
			EventRepo:  repository.GetEventRepository(),
			MarginRepo: repository.InitMarginRepository(),
		}
	})
	return tradeServiceInstance
}

type rateSnapshot struct {
	Ask float64 `json:"ask"`
}

func (s *TradeService) validateSlippage(ctx context.Context, tenantID int64, requestedRate float64) (finalRate, mcxRate, marginApplied, gstApplied float64, err error) {
	// 1. Get Live Rate from Redis
	rateStr, err := s.Redis.GetHashKeyWithOriginalKey(ctx, constants.RedisKeyLatestRawRate, "GOLD")
	if err != nil || rateStr == "" {
		return 0, 0, 0, 0, fmt.Errorf("failed to fetch live rate from Redis: %w", err)
	}

	var rate rateSnapshot
	if err := json.Unmarshal([]byte(rateStr), &rate); err != nil {
		return 0, 0, 0, 0, fmt.Errorf("failed to parse live rate: %w", err)
	}
	mcxRate = rate.Ask

	// 2. Get Tenant Margin
	margin, err := s.MarginRepo.GetMarginByTenant(ctx, tenantID, "GOLD")
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("failed to get margin config: %w", err)
	}

	// 3. Calculate Final Rate
	switch margin.SellMarginType {
	case "FIXED_INR", "FLAT":
		marginApplied = margin.SellMarginValue
	case "PERCENTAGE":
		marginApplied = mcxRate * (margin.SellMarginValue / 100.0)
	}

	rateWithMargin := mcxRate + marginApplied

	if margin.IsGSTEnabled {
		gstApplied = rateWithMargin * (margin.GSTPercentage / 100.0)
	}

	finalRate = rateWithMargin + gstApplied

	// 4. Validate Slippage
	if math.Abs(finalRate-requestedRate) > 30.0 {
		return 0, 0, 0, 0, fmt.Errorf("SLIPPAGE_EXCEEDED: Live rate moved beyond allowable tolerance. Expected: %f, Live: %f", requestedRate, finalRate)
	}

	return finalRate, mcxRate, marginApplied, gstApplied, nil
}

func (s *TradeService) ExecuteTrade(ctx context.Context, req interfaces.TradeExecutionRequest, ipAddress, adminID string) (*models.GoldTransactionLedger, error) {
	log.Printf("[TradeService] ExecuteTrade: tenantID=%d, userID=%d, reqRate=%f, reqWeight=%f, reqAmount=%f, ip=%s",
		req.TenantID, req.UserID, req.RequestedRatePerGram, req.WeightGrams, req.TotalAmountINR, ipAddress)

	finalRate, mcxRate, marginApplied, gstApplied, err := s.validateSlippage(ctx, req.TenantID, req.RequestedRatePerGram)
	if err != nil {
		log.Printf("[TradeService] Slippage validation failed for userID=%d, tenantID=%d: %v", req.UserID, req.TenantID, err)
		return nil, err
	}

	// Calculate mathematically binding totals and round them/align them precisely
	var finalWeight, finalTotalINR float64

	if req.WeightGrams > 0 {
		// 1. User is buying a specific weight (e.g., exactly 1.5000g)
		finalWeight = math.Round(req.WeightGrams*10000) / 10000
		finalTotalINR = math.Round((finalWeight*finalRate)*100) / 100
	} else if req.TotalAmountINR > 0 {
		// 2. User is buying a specific fiat amount (e.g., exactly ₹5000)
		finalTotalINR = math.Round(req.TotalAmountINR*100) / 100
		finalWeight = math.Round((finalTotalINR/finalRate)*10000) / 10000
	} else {
		return nil, fmt.Errorf("INVALID_PAYLOAD: must specify either WeightGrams or TotalAmountINR")
	}

	// Open PostgreSQL Transaction
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Initialize the Ledger Entry
	entry := &models.GoldTransactionLedger{
		TenantID:            req.TenantID,
		UserID:              req.UserID,
		EventType:           "GOLD_PURCHASE",
		PaymentMode:         req.PaymentMode,
		WeightGrams:         finalWeight,
		TotalAmountINR:      finalTotalINR,
		MCXBaseRate:         mcxRate,
		MasterMarginApplied: 0, // Future use
		TenantMarginApplied: marginApplied,
		GSTApplied:          gstApplied,
		FinalRatePerGram:    finalRate,
		ReferenceID:         req.ReferenceID,
	}

	// Insert into Ledger (Locks balance row, calculates offset, inserts new row, and emits event)
	// 1. Insert into Ledger (LedgerRepo remains DUMB and isolated)
	result, err := s.LedgerRepo.RecordTransactionWithTX(ctx, tx, entry)
	if err != nil {
		return nil, err
	}

	// 2. Event Sourcing (TradeService orchestrates the outbox)
	tenantIdStr := fmt.Sprintf("%d", req.TenantID)
	tradeEvent := events.GenerateGoldPurchaseEvent(tenantIdStr, adminID, ipAddress, result)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, &tradeEvent.BaseEvent); err != nil {
		return nil, fmt.Errorf("failed to save trade event: %w", err)
	}

	// 3. B2B Ledger Validation (Locks margin row and increments unlifted weight)
	if err := s.MarginRepo.IncrementUnliftedGramsWithTx(ctx, tx, req.TenantID, "GOLD", finalWeight); err != nil {
		return nil, err
	}

	// 4. Commit Transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("[TradeService] Trade successful: tenantID=%d, userID=%d, weight=%f, amount=%f, ledgerUUID=%s",
		req.TenantID, req.UserID, finalWeight, finalTotalINR, result.UUID)

	return result, nil
}
