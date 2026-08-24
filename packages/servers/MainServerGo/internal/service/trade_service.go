package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"

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
	if margin.SellMarginType == "FIXED_INR" || margin.SellMarginType == "FLAT" {
		marginApplied = margin.SellMarginValue
	} else if margin.SellMarginType == "PERCENTAGE" {
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
	finalRate, mcxRate, marginApplied, gstApplied, err := s.validateSlippage(ctx, req.TenantID, req.RequestedRatePerGram)
	if err != nil {
		return nil, err
	}

	// Calculate mathematically binding totals
	var finalWeight, finalTotalINR float64

	if req.WeightGrams > 0 {
		// 1. User is buying a specific weight (e.g., exactly 1.5000g)
		finalWeight = req.WeightGrams
		finalTotalINR = finalWeight * finalRate
	} else if req.TotalAmountINR > 0 {
		// 2. User is buying a specific fiat amount (e.g., exactly ₹5000)
		finalTotalINR = req.TotalAmountINR
		finalWeight = finalTotalINR / finalRate
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
	result, err := s.LedgerRepo.RecordTransactionWithTX(ctx, tx, entry, ipAddress, adminID)
	if err != nil {
		return nil, err
	}

	// Commit Transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return result, nil
}
