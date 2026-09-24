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
	DB             *postgres.PostgresDBStruct
	Redis          *redis_client.RedisClientStruct
	LedgerRepo     *repository.GoldLedgerRepository
	EventRepo      *repository.EventRepository
	MarginRepo     *repository.MarginRepository
	RedemptionRepo *repository.RedemptionRepository
}

func InitTradeService() *TradeService {
	tradeServiceOnce.Do(func() {
		tradeServiceInstance = &TradeService{
			DB:             postgres.GetPostgresDB(),
			Redis:          redis_client.InitRedisClient(),
			LedgerRepo:     repository.InitGoldLedgerRepo(),
			EventRepo:      repository.GetEventRepository(),
			MarginRepo:     repository.InitMarginRepository(),
			RedemptionRepo: repository.InitRedemptionRepo(),
		}
	})
	return tradeServiceInstance
}

const (
	ledgerEventReversal     = "SYSTEM_REVERSAL"
	reversalReferencePrefix = "REVERSAL_"
)

type rateSnapshot struct {
	Ask float64 `json:"ask"`
	Bid float64 `json:"bid"`
}

func (s *TradeService) validateSlippage(ctx context.Context, tenantID int64, requestedRate float64, action string) (finalRate, mcxRate, marginApplied, gstApplied float64, err error) {
	rateStr, err := s.Redis.GetHashKeyWithOriginalKey(ctx, constants.RedisKeyLatestRawRate, "GOLD")
	if err != nil || rateStr == "" {
		return 0, 0, 0, 0, fmt.Errorf("failed to fetch live rate from Redis: %w", err)
	}

	var rate rateSnapshot
	if err := json.Unmarshal([]byte(rateStr), &rate); err != nil {
		return 0, 0, 0, 0, fmt.Errorf("failed to parse live rate: %w", err)
	}

	if action == "SELL" || action == "REDEEM" {
		mcxRate = rate.Bid
	} else {
		mcxRate = rate.Ask
	}

	margin, err := s.MarginRepo.GetMarginByTenant(ctx, tenantID, "GOLD")
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("failed to get margin config: %w", err)
	}

	switch margin.SellMarginType {
	case "FIXED_INR", "FLAT":
		marginApplied = margin.SellMarginValue
	case "PERCENTAGE":
		marginApplied = mcxRate * (margin.SellMarginValue / 100.0)
	}

	if action == "SELL" || action == "REDEEM" {
		rateWithMargin := mcxRate - marginApplied
		gstApplied = 0
		finalRate = rateWithMargin
	} else {
		rateWithMargin := mcxRate + marginApplied
		if margin.IsGSTEnabled {
			gstApplied = rateWithMargin * (margin.GSTPercentage / 100.0)
		}
		finalRate = rateWithMargin + gstApplied
	}

	if math.Abs(finalRate-requestedRate) > 30.0 {
		return 0, 0, 0, 0, fmt.Errorf("%w: expected %f, live %f", interfaces.ErrSlippageExceeded, requestedRate, finalRate)
	}

	return finalRate, mcxRate, marginApplied, gstApplied, nil
}

func (s *TradeService) ExecuteTrade(ctx context.Context, req interfaces.TradeExecutionRequest, ipAddress, adminID string) (*models.GoldTransactionLedger, error) {
	if req.Action == "" {
		req.Action = "BUY"
	}

	log.Printf("[TradeService] ExecuteTrade (%s): tenantID=%d, userID=%d, reqRate=%f, reqWeight=%f, reqAmount=%f, ip=%s",
		req.Action, req.TenantID, req.UserID, req.RequestedRatePerGram, req.WeightGrams, req.TotalAmountINR, ipAddress)

	finalRate, mcxRate, marginApplied, gstApplied, err := s.validateSlippage(ctx, req.TenantID, req.RequestedRatePerGram, req.Action)
	if err != nil {
		log.Printf("[TradeService] Slippage validation failed for userID=%d, tenantID=%d: %v", req.UserID, req.TenantID, err)
		return nil, err
	}

	var finalWeight, finalTotalINR float64

	if req.WeightGrams > 0 {
		finalWeight = math.Round(req.WeightGrams*10000) / 10000
		finalTotalINR = math.Round((finalWeight*finalRate)*100) / 100
	} else if req.TotalAmountINR > 0 {
		finalTotalINR = math.Round(req.TotalAmountINR*100) / 100
		finalWeight = math.Round((finalTotalINR/finalRate)*10000) / 10000
	} else {
		return nil, interfaces.ErrInvalidTradePayload
	}

	eventType := "GOLD_PURCHASE"
	if req.Action == "SELL" || req.Action == "REDEEM" {
		eventType = "PHYSICAL_REDEMPTION"
		finalWeight = -finalWeight
	}

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	entry := &models.GoldTransactionLedger{
		TenantID:            req.TenantID,
		UserID:              req.UserID,
		EventType:           eventType,
		PaymentMode:         req.PaymentMode,
		WeightGrams:         finalWeight,
		TotalAmountINR:      finalTotalINR,
		MCXBaseRate:         mcxRate,
		MasterMarginApplied: 0,
		TenantMarginApplied: marginApplied,
		GSTApplied:          gstApplied,
		FinalRatePerGram:    finalRate,
		ReferenceID:         req.ReferenceID,
	}

	result, err := s.LedgerRepo.RecordTransactionWithTX(ctx, tx, entry)
	if err != nil {
		return nil, err
	}

	if req.Action == "REDEEM" {
		addressJSON, _ := json.Marshal(req.ShippingAddress)
		fulfillment := &models.RedemptionFulfillment{
			TenantID:           req.TenantID,
			UserID:             req.UserID,
			LedgerID:           result.ID,
			ItemSKU:            "CUSTOM_GRAMS", // Or parse from req
			FulfillmentStatus:  "PENDING",
			ShippingDetailJSON: addressJSON,
		}
		if err := s.RedemptionRepo.CreateRedemptionFulfillmentWithTX(ctx, tx, fulfillment); err != nil {
			return nil, fmt.Errorf("failed to save redemption details: %w", err)
		}
	}

	tenantIdStr := fmt.Sprintf("%d", req.TenantID)
	tradeEvent := events.GenerateGoldPurchaseEvent(tenantIdStr, adminID, ipAddress, result)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, &tradeEvent.BaseEvent); err != nil {
		return nil, fmt.Errorf("failed to save trade event: %w", err)
	}

	if err := s.MarginRepo.IncrementUnliftedGramsWithTx(ctx, tx, req.TenantID, "GOLD", finalWeight); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	s.EventRepo.PublishAsync(&tradeEvent.BaseEvent)

	log.Printf("[TradeService] Trade successful: tenantID=%d, userID=%d, weight=%f, amount=%f, ledgerUUID=%s",
		req.TenantID, req.UserID, finalWeight, finalTotalINR, result.UUID)

	return result, nil
}

func (s *TradeService) ReverseTransaction(ctx context.Context, tenantID int64, ledgerUUID string, adminID string, ipAddress string) (*models.GoldTransactionLedger, error) {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Lock the original row so two concurrent reversals serialize here.
	original, err := s.LedgerRepo.GetEntryForUpdateWithTX(ctx, tx, tenantID, ledgerUUID)
	if err != nil {
		return nil, err
	}
	if original.EventType == ledgerEventReversal {
		return nil, interfaces.ErrLedgerNotReversible
	}

	// 2. Each entry may be reversed only once.
	reversalRef := reversalReferencePrefix + ledgerUUID
	alreadyReversed, err := s.LedgerRepo.ReferenceExistsWithTX(ctx, tx, tenantID, reversalRef)
	if err != nil {
		return nil, err
	}
	if alreadyReversed {
		return nil, interfaces.ErrLedgerAlreadyReversed
	}

	reversalEntry := &models.GoldTransactionLedger{
		TenantID:            tenantID,
		UserID:              original.UserID,
		EventType:           ledgerEventReversal,
		PaymentMode:         "NONE", // payment_mode_enum has no SYSTEM value
		WeightGrams:         -original.WeightGrams,
		TotalAmountINR:      -original.TotalAmountINR,
		MCXBaseRate:         original.MCXBaseRate,
		MasterMarginApplied: 0,
		TenantMarginApplied: -original.TenantMarginApplied,
		GSTApplied:          -original.GSTApplied,
		FinalRatePerGram:    original.FinalRatePerGram,
		ReferenceID:         reversalRef,
	}

	// RecordTransactionWithTX rejects the reversal if it would make the balance negative
	// (e.g. reversing a purchase whose gold was already sold).
	result, err := s.LedgerRepo.RecordTransactionWithTX(ctx, tx, reversalEntry)
	if err != nil {
		return nil, err
	}

	tenantIdStr := fmt.Sprintf("%d", tenantID)
	reversalEvent := events.GenerateGoldPurchaseEvent(tenantIdStr, adminID, ipAddress, result)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, &reversalEvent.BaseEvent); err != nil {
		return nil, fmt.Errorf("failed to save reversal event: %w", err)
	}

	if err := s.MarginRepo.IncrementUnliftedGramsWithTx(ctx, tx, tenantID, "GOLD", -original.WeightGrams); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit reversal: %w", err)
	}
	s.EventRepo.PublishAsync(&reversalEvent.BaseEvent)

	return result, nil
}
